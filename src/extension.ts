// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get extension configuration
 */
function getConfiguration() {
  const config = vscode.workspace.getConfiguration('autoHeader');
  return {
    supportedExtensions: config.get<string[]>('supportedExtensions', ['.c', '.cpp', '.cc']),
    headerExtensions: config.get<string[]>('headerExtensions', ['.h']),
    insertEmptyLineAfter: config.get<boolean>('insertEmptyLineAfter', true),
    includeFormat: config.get<string>('includeFormat', 'quotes'),
    headerTemplate: config.get<string>('headerTemplate', '#pragma once\n\n// Header file for ${filename}\n\n'),
    askBeforeCreating: config.get<boolean>('askBeforeCreating', true)
  };
}

/**
 * Check if file is a C/C++ source file
 */
function isCppSourceFile(filePath: string): boolean {
  const config = getConfiguration();
  const fileExtension = path.extname(filePath).toLowerCase();
  return config.supportedExtensions.includes(fileExtension);
}

/**
 * Find appropriate insertion position (skip comments at the top of the file)
 */
function findInsertPosition(document: vscode.TextDocument): number {
  const lines = document.getText().split('\n');
  let insertLineIndex = 0;

  // Skip comments at the beginning of the file
  while (insertLineIndex < lines.length) {
    const line = lines[insertLineIndex].trim();
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
      insertLineIndex++;
    } else {
      break;
    }
  }

  return insertLineIndex;
}

/**
 * Generate header file include path
 */
function generateHeaderIncludePath(filePath: string, workspaceFolder: vscode.WorkspaceFolder): {
  headerIncludePath: string;
  headerFilePath: string;
  baseNameWithoutExt: string;
  foundHeader: boolean;
} {
  const config = getConfiguration();
  const fileExtension = path.extname(filePath).toLowerCase();
  const relativeSourcePath = path.relative(workspaceFolder.uri.fsPath, filePath);
  const relativeDir = path.dirname(relativeSourcePath);
  const baseNameWithoutExt = path.basename(filePath, fileExtension);

  // Try to find matching header file (try multiple extensions)
  let headerFilePath = '';
  let headerIncludePath = '';
  let foundHeader = false;

  for (const ext of config.headerExtensions) {
    // Generate header file path with the same relative path as the source file
    headerIncludePath = path.join(relativeDir, baseNameWithoutExt + ext).replace(/\\/g, '/');

    // Generate absolute path to check if the file exists
    headerFilePath = path.join(workspaceFolder.uri.fsPath, headerIncludePath);

    if (fs.existsSync(headerFilePath)) {
      foundHeader = true;
      break;
    }
  }

  return { headerIncludePath, headerFilePath, baseNameWithoutExt, foundHeader };
}

/**
 * Create a new header file
 */
async function createHeaderFile(
  sourceFilePath: string,
  headerFilePath: string,
  headerIncludePath: string,
  baseNameWithoutExt: string
): Promise<boolean> {
  const config = getConfiguration();

  // If the configuration requires asking the user whether to create the file
  if (config.askBeforeCreating) {
    const choice = await vscode.window.showInformationMessage(
      `Header file "${headerIncludePath}" does not exist. Create it?`,
      'Create', 'Cancel'
    );

    if (choice !== 'Create') {
      return false;
    }
  }

  try {
    // Ensure directory exists
    const headerDir = path.dirname(headerFilePath);
    if (!fs.existsSync(headerDir)) {
      fs.mkdirSync(headerDir, { recursive: true });
    }

    // Create template content with header guard
    const headerContent = config.headerTemplate.replace('${filename}', baseNameWithoutExt);

    // Write to file
    fs.writeFileSync(headerFilePath, headerContent);

    // Open the newly created file
    await vscode.window.showTextDocument(vscode.Uri.file(headerFilePath));

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating header file: ${error}`);
    return false;
  }
}

/**
 * Add header file include, with option to create if it doesn't exist
 */
async function addHeaderInclude(editor: vscode.TextEditor, createIfNotExist: boolean = false): Promise<void> {
  const config = getConfiguration();

  // Get current file path
  const filePath = editor.document.uri.fsPath;

  // Check if it's a C/C++ source file
  if (!isCppSourceFile(filePath)) {
    vscode.window.showErrorMessage(`Current file is not a C/C++ source file (${config.supportedExtensions.join(', ')})`);
    return;
  }

  // Get workspace folder
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('File is not part of a workspace!');
    return;
  }

  // Generate header file path
  const { headerIncludePath, headerFilePath, baseNameWithoutExt, foundHeader } =
    generateHeaderIncludePath(filePath, workspaceFolder);

  // If header file doesn't exist and user chooses not to create it, terminate
  if (!foundHeader) {
    if (!createIfNotExist) {
      vscode.window.showErrorMessage(`Could not find matching header file (tried ${config.headerExtensions.join(', ')})`);
      return;
    } else {
      // Use the first header extension by default
      const preferredHeaderExt = config.headerExtensions[0];
      const newHeaderPath = path.join(
        path.dirname(filePath),
        baseNameWithoutExt + preferredHeaderExt
      );
      const relativeHeaderPath = path.relative(
        workspaceFolder.uri.fsPath,
        newHeaderPath
      ).replace(/\\/g, '/');

      const created = await createHeaderFile(
        filePath,
        newHeaderPath,
        relativeHeaderPath,
        baseNameWithoutExt
      );

      if (!created) {
        return;
      }

      // Update header file paths for later use
      const headerFilePath = newHeaderPath;
      const headerIncludePath = relativeHeaderPath;
    }
  }

  // Create include statement based on configuration
  let includeStatement: string;
  if (config.includeFormat === 'quotes') {
    includeStatement = `#include "${headerIncludePath}"`;
  } else {
    includeStatement = `#include <${headerIncludePath}>`;
  }

  // Check if the include statement already exists
  if (editor.document.getText().includes(includeStatement)) {
    vscode.window.showInformationMessage('Header file is already included in the current file!');
    return;
  }

  // Find appropriate position to insert
  const insertLineIndex = findInsertPosition(editor.document);

  // Insert the include statement
  await editor.edit(editBuilder => {
    const position = new vscode.Position(insertLineIndex, 0);
    const newText = config.insertEmptyLineAfter
      ? includeStatement + '\n\n'
      : includeStatement + '\n';
    editBuilder.insert(position, newText);
  });

  vscode.window.showInformationMessage(`Added ${includeStatement} to the file.`);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "auto-header" is now active!');

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(file-add) Add Header";
  statusBarItem.tooltip = "Add corresponding header file to the current C/C++ source file";
  statusBarItem.command = 'auto-header.run';
  context.subscriptions.push(statusBarItem);

  // Register event to update status bar item visibility
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarVisibility)
  );

  // Initialize status bar visibility
  updateStatusBarVisibility(vscode.window.activeTextEditor);

  // Register command: Add header file
  const disposable1 = vscode.commands.registerCommand('auto-header.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found!');
      return;
    }

    await addHeaderInclude(editor, false);
  });

  // Register command: Create and add header file
  const disposable2 = vscode.commands.registerCommand('auto-header.createAndInclude', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found!');
      return;
    }

    await addHeaderInclude(editor, true);
  });

  context.subscriptions.push(disposable1, disposable2);

  // Function: Update status bar item visibility
  function updateStatusBarVisibility(editor: vscode.TextEditor | undefined): void {
    if (editor && isCppSourceFile(editor.document.uri.fsPath)) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }
}

export function deactivate() { }
