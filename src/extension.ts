// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Main class that handles the Auto Header extension functionality
 */
class AutoHeaderExtension {
  private statusBarItem: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;
  private configCache: any = null;
  private configLastUpdate: number = 0;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Initialize status bar
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0
    );
    this.statusBarItem.text = "$(file-add) Add Header";
    this.statusBarItem.tooltip = "Add corresponding header file to the current C/C++ source file";
    this.statusBarItem.command = 'auto-header.run';
    context.subscriptions.push(this.statusBarItem);

    // Register commands
    this.registerCommands();

    // Register event listeners
    this.registerEventListeners();

    // Initialize status bar visibility
    this.updateStatusBarVisibility(vscode.window.activeTextEditor);

    console.log('Extension "auto-header" is now active!');
  }

  /**
   * Register all extension commands
   */
  private registerCommands(): void {
    // Register command: Add header file
    const disposable1 = vscode.commands.registerCommand('auto-header.run', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
      }

      await this.addHeaderInclude(editor, false);
    });

    // Register command: Create and add header file
    const disposable2 = vscode.commands.registerCommand('auto-header.createAndInclude', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
      }

      await this.addHeaderInclude(editor, true);
    });

    // Register command: Sort includes in current file
    const disposable3 = vscode.commands.registerCommand('auto-header.sortIncludes', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
      }

      if (await this.sortIncludeStatements(editor, true)) {
        vscode.window.showInformationMessage('Include statements have been sorted');
      } else {
        vscode.window.showInformationMessage('No include statements to sort');
      }
    });

    // Register command: Switch between header and source files
    const disposable4 = vscode.commands.registerCommand('auto-header.switchHeaderSource', async () => {
      await this.switchHeaderSource();
    });

    this.context.subscriptions.push(disposable1, disposable2, disposable3, disposable4);
  }

  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Register event to update status bar item visibility
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(
        this.updateStatusBarVisibility.bind(this)
      )
    );

    // Listen for configuration changes to reset the cache
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('autoHeader')) {
          this.configCache = null;
        }
      })
    );
  }

  /**
   * Get extension configuration with caching
   */
  private getConfiguration() {
    // Use cached configuration if available and not too old (5 seconds max age)
    const now = Date.now();
    if (this.configCache && now - this.configLastUpdate < 5000) {
      return this.configCache;
    }

    const config = vscode.workspace.getConfiguration('autoHeader');
    this.configCache = {
      supportedExtensions: config.get<string[]>('supportedExtensions', ['.c', '.cpp', '.cc']),
      headerExtensions: config.get<string[]>('headerExtensions', ['.h']),
      insertEmptyLineAfter: config.get<boolean>('insertEmptyLineAfter', true),
      includeFormat: config.get<string>('includeFormat', 'quotes'),
      headerTemplate: config.get<string>('headerTemplate', '#pragma once\n\n// Header file for ${filename}\n\n'),
      askBeforeCreating: config.get<boolean>('askBeforeCreating', true)
    };

    this.configLastUpdate = now;
    return this.configCache;
  }

  /**
   * Check if file is a C/C++ source file
   */
  private isCppSourceFile(filePath: string): boolean {
    if (!filePath) {
      return false;
    }

    const config = this.getConfiguration();
    const fileExtension = path.extname(filePath).toLowerCase();
    return config.supportedExtensions.includes(fileExtension);
  }

  /**
   * Find appropriate insertion position (skip comments at the top of the file)
   */
  private findInsertPosition(document: vscode.TextDocument): number {
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
   * Find header file using multiple strategies
   * This significantly improves the header detection capability
   */
  private async findHeaderFile(
    filePath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    baseNameWithoutExt: string
  ): Promise<{
    headerIncludePath: string;
    headerFilePath: string;
    foundHeader: boolean;
  }> {
    const config = this.getConfiguration();
    const sourceDir = path.dirname(filePath);
    const strategies = [
      // Strategy 1: Same directory as source
      async () => this.findHeaderInDirectory(sourceDir, baseNameWithoutExt, workspaceFolder),

      // Strategy 2: Check "include" directory adjacent to source
      async () => {
        const includeDir = path.join(path.dirname(sourceDir), 'include');
        return this.findHeaderInDirectory(includeDir, baseNameWithoutExt, workspaceFolder);
      },

      // Strategy 3: Check for 'include' subdirectory 
      async () => {
        const includeDir = path.join(sourceDir, 'include');
        return this.findHeaderInDirectory(includeDir, baseNameWithoutExt, workspaceFolder);
      },

      // Strategy 4: Navigate up to a parent directory and check for an include directory
      async () => {
        const parentDir = path.dirname(sourceDir);
        const includeDir = path.join(parentDir, 'include');
        return this.findHeaderInDirectory(includeDir, baseNameWithoutExt, workspaceFolder);
      },

      // Strategy 5: Check for a headers directory
      async () => {
        const headersDir = path.join(path.dirname(sourceDir), 'headers');
        return this.findHeaderInDirectory(headersDir, baseNameWithoutExt, workspaceFolder);
      }
    ];

    // Try each strategy in order
    for (const strategy of strategies) {
      const result = await strategy();
      if (result.foundHeader) {
        return result;
      }
    }

    // If no header found, return the default path (same directory)
    return {
      headerIncludePath: path.join(
        path.relative(workspaceFolder.uri.fsPath, sourceDir),
        baseNameWithoutExt + config.headerExtensions[0]
      ).replace(/\\/g, '/'),
      headerFilePath: path.join(sourceDir, baseNameWithoutExt + config.headerExtensions[0]),
      foundHeader: false
    };
  }

  /**
   * Helper method to search for header files in a specific directory
   */
  private async findHeaderInDirectory(
    directory: string,
    baseNameWithoutExt: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<{
    headerIncludePath: string;
    headerFilePath: string;
    foundHeader: boolean;
  }> {
    const config = this.getConfiguration();

    // Skip if the directory doesn't exist
    if (!fs.existsSync(directory)) {
      return { headerIncludePath: '', headerFilePath: '', foundHeader: false };
    }

    // Try each possible header extension
    for (const ext of config.headerExtensions) {
      const headerFilePath = path.join(directory, baseNameWithoutExt + ext);

      if (fs.existsSync(headerFilePath)) {
        const headerIncludePath = path.relative(
          workspaceFolder.uri.fsPath,
          headerFilePath
        ).replace(/\\/g, '/');

        return {
          headerIncludePath,
          headerFilePath,
          foundHeader: true
        };
      }
    }

    return { headerIncludePath: '', headerFilePath: '', foundHeader: false };
  }

  /**
   * Generate header file include path
   */
  private async generateHeaderIncludePath(filePath: string, workspaceFolder: vscode.WorkspaceFolder): Promise<{
    headerIncludePath: string;
    headerFilePath: string;
    baseNameWithoutExt: string;
    foundHeader: boolean;
  }> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const baseNameWithoutExt = path.basename(filePath, fileExtension);

    // Use the enhanced header detection algorithm
    const { headerIncludePath, headerFilePath, foundHeader } =
      await this.findHeaderFile(filePath, workspaceFolder, baseNameWithoutExt);

    return { headerIncludePath, headerFilePath, baseNameWithoutExt, foundHeader };
  }

  /**
   * Create a new header file
   */
  private async createHeaderFile(
    sourceFilePath: string,
    headerFilePath: string,
    headerIncludePath: string,
    baseNameWithoutExt: string
  ): Promise<boolean> {
    const config = this.getConfiguration();

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
      const headerContent = config.headerTemplate.replace(/\${filename}/g, baseNameWithoutExt);

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
   * Sort include statements in the document
   * @param editor The text editor to sort includes in
   * @param force Force sorting even if sorting is disabled in settings
   */
  private async sortIncludeStatements(editor: vscode.TextEditor, force: boolean = false): Promise<boolean> {
    const config = this.getConfiguration();

    // Check if sorting is enabled in configuration or forced
    const sortIncludes = force || config.sortIncludes || false;
    if (!sortIncludes) {
      return false;
    }

    // First, identify all include statements
    const document = editor.document;
    const text = document.getText();
    const lines = text.split('\n');

    // Collect include statements and their positions
    interface IncludeStatement {
      lineNumber: number;
      text: string;
      isSystemInclude: boolean;
    }

    const includeStatements: IncludeStatement[] = [];
    const includeRegex = /^\s*#\s*include\s*[<"]([^>"]*)[>"]/;

    // First, identify all consecutive include blocks
    let includeBlockStart = -1;
    let includeBlockEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const match = includeRegex.exec(lines[i]);
      if (match) {
        if (includeBlockStart === -1) {
          includeBlockStart = i;
        }
        includeBlockEnd = i;

        includeStatements.push({
          lineNumber: i,
          text: lines[i],
          isSystemInclude: lines[i].includes('#include <')
        });
      } else if (includeBlockStart !== -1 && includeBlockEnd !== -1) {
        // If we've found a non-include line after some includes, check if it's just a blank line
        if (lines[i].trim() === '') {
          continue; // Skip blank lines
        } else {
          // We've reached the end of a block of includes
          break;
        }
      }
    }

    // If no includes or only one include found, no need to sort
    if (includeStatements.length <= 1) {
      return false;
    }

    // Sort the include statements
    includeStatements.sort((a, b) => {
      // First sort by system vs. user includes
      if (a.isSystemInclude && !b.isSystemInclude) {
        return -1;
      }
      if (!a.isSystemInclude && b.isSystemInclude) {
        return 1;
      }

      // Then sort alphabetically
      return a.text.localeCompare(b.text);
    });

    // Replace the original includes with the sorted ones
    await editor.edit(editBuilder => {
      const startLine = includeStatements[0].lineNumber;
      const endLine = includeStatements[includeStatements.length - 1].lineNumber;

      // Calculate the range to replace
      const startPos = new vscode.Position(startLine, 0);
      const endPos = new vscode.Position(endLine, lines[endLine].length);
      const range = new vscode.Range(startPos, endPos);

      // Create the sorted text
      const sortedText = includeStatements.map(inc => inc.text).join('\n');

      // Replace the range
      editBuilder.replace(range, sortedText);
    });

    return true;
  }

  /**
   * Add header file include, with option to create if it doesn't exist
   */
  private async addHeaderInclude(editor: vscode.TextEditor, createIfNotExist: boolean = false): Promise<void> {
    const config = this.getConfiguration();

    // Get current file path
    const filePath = editor.document.uri.fsPath;

    // Check if it's a C/C++ source file
    if (!this.isCppSourceFile(filePath)) {
      vscode.window.showErrorMessage(`Current file is not a C/C++ source file (${config.supportedExtensions.join(', ')})`);
      return;
    }

    // Get workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('File is not part of a workspace!');
      return;
    }

    // Generate header file path with the enhanced algorithm
    const { headerIncludePath, headerFilePath, baseNameWithoutExt, foundHeader } =
      await this.generateHeaderIncludePath(filePath, workspaceFolder);

    // Handle non-existent header file
    let finalHeaderIncludePath = headerIncludePath;
    let finalHeaderFilePath = headerFilePath;

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

        const created = await this.createHeaderFile(
          filePath,
          newHeaderPath,
          relativeHeaderPath,
          baseNameWithoutExt
        );

        if (!created) {
          return;
        }

        // Update header file paths for later use
        finalHeaderFilePath = newHeaderPath;
        finalHeaderIncludePath = relativeHeaderPath;
      }
    }

    // Create include statement based on configuration
    let includeStatement: string;
    if (config.includeFormat === 'quotes') {
      includeStatement = `#include "${finalHeaderIncludePath}"`;
    } else {
      includeStatement = `#include <${finalHeaderIncludePath}>`;
    }

    // Check if the include statement already exists
    if (editor.document.getText().includes(includeStatement)) {
      vscode.window.showInformationMessage('Header file is already included in the current file!');
      return;
    }

    // Find appropriate position to insert
    const insertLineIndex = this.findInsertPosition(editor.document);

    // Insert the include statement
    try {
      await editor.edit(editBuilder => {
        const position = new vscode.Position(insertLineIndex, 0);
        const newText = config.insertEmptyLineAfter
          ? includeStatement + '\n\n'
          : includeStatement + '\n';
        editBuilder.insert(position, newText);
      });

      // Sort includes if enabled
      await this.sortIncludeStatements(editor);

      vscode.window.showInformationMessage(`Added ${includeStatement} to the file.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error adding include statement: ${error}`);
    }
  }

  /**
   * Find the corresponding pair file (.h -> .cc or .cc -> .h)
   */
  private async findCorrespondingFile(filePath: string, workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
    const config = this.getConfiguration();
    const fileExtension = path.extname(filePath).toLowerCase();
    const baseNameWithoutExt = path.basename(filePath, fileExtension);
    const fileDir = path.dirname(filePath);
    
    // If current file is a header file, look for a source file
    if (config.headerExtensions.includes(fileExtension)) {
      // Try to find a source file with matching name
      for (const srcExt of config.supportedExtensions) {
        const possibleSourceFile = path.join(fileDir, baseNameWithoutExt + srcExt);
        if (fs.existsSync(possibleSourceFile)) {
          return possibleSourceFile;
        }
      }
      
      // Try source file in 'src' directory if the current file is in 'include'
      const includePattern = /[\/\\]include[\/\\]/;
      if (includePattern.test(fileDir)) {
        const srcDir = fileDir.replace(includePattern, '/src/');
        if (fs.existsSync(srcDir)) {
          for (const srcExt of config.supportedExtensions) {
            const possibleSourceFile = path.join(srcDir, baseNameWithoutExt + srcExt);
            if (fs.existsSync(possibleSourceFile)) {
              return possibleSourceFile;
            }
          }
        }
      }
    } 
    // If current file is a source file, look for a header file
    else if (config.supportedExtensions.includes(fileExtension)) {
      // First try to find the header file using our existing header detection
      const { headerFilePath, foundHeader } = 
        await this.findHeaderFile(filePath, workspaceFolder, baseNameWithoutExt);
      
      if (foundHeader) {
        return headerFilePath;
      }
    }
    
    return undefined;
  }

  /**
   * Switch between header and source file
   */
  private async switchHeaderSource(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found!');
      return;
    }
    
    const filePath = editor.document.uri.fsPath;
    const fileExtension = path.extname(filePath).toLowerCase();
    const config = this.getConfiguration();
    
    // Check if file is either a header or source file
    if (!config.headerExtensions.includes(fileExtension) && 
        !config.supportedExtensions.includes(fileExtension)) {
      vscode.window.showErrorMessage(
        `Current file is neither a C/C++ header (${config.headerExtensions.join(', ')}) nor source file (${config.supportedExtensions.join(', ')})`
      );
      return;
    }
    
    // Get workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('File is not part of a workspace!');
      return;
    }
    
    // Find corresponding file
    const correspondingFile = await this.findCorrespondingFile(filePath, workspaceFolder);
    
    if (correspondingFile) {
      // Open the corresponding file
      const document = await vscode.workspace.openTextDocument(correspondingFile);
      await vscode.window.showTextDocument(document);
    } else {
      // Ask if user wants to create the corresponding file
      const baseNameWithoutExt = path.basename(filePath, fileExtension);
      let newFileExt: string;
      let newFileType: string;
      
      if (config.headerExtensions.includes(fileExtension)) {
        // Current file is a header, so create a source file
        newFileExt = config.supportedExtensions[0];
        newFileType = 'source';
      } else {
        // Current file is a source, so create a header file
        newFileExt = config.headerExtensions[0];
        newFileType = 'header';
      }
      
      const choice = await vscode.window.showInformationMessage(
        `No corresponding ${newFileType} file found. Create ${baseNameWithoutExt}${newFileExt}?`,
        'Create', 'Cancel'
      );
      
      if (choice === 'Create') {
        // Create the new file
        const newFilePath = path.join(path.dirname(filePath), baseNameWithoutExt + newFileExt);
        
        try {
          // Generate appropriate content based on file type
          let content = '';
          if (newFileType === 'header') {
            content = config.headerTemplate.replace(/\${filename}/g, baseNameWithoutExt);
          } else {
            // For source files, add include to the header
            const relativePath = path.relative(
              workspaceFolder.uri.fsPath,
              path.join(path.dirname(filePath), baseNameWithoutExt + config.headerExtensions[0])
            ).replace(/\\/g, '/');
            
            content = `#include "${relativePath}"\n\n`;
          }
          
          // Ensure directory exists
          const dir = path.dirname(newFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write the file
          fs.writeFileSync(newFilePath, content);
          
          // Open the new file
          const document = await vscode.workspace.openTextDocument(newFilePath);
          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(`Error creating file: ${error}`);
        }
      }
    }
  }

  /**
   * Update status bar item visibility
   */
  private updateStatusBarVisibility(editor: vscode.TextEditor | undefined): void {
    if (editor && this.isCppSourceFile(editor.document.uri.fsPath)) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Initialize the extension
  new AutoHeaderExtension(context);
}

export function deactivate() { }
