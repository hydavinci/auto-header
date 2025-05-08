import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationManager } from '../config/configuration';
import { FileSystemService } from '../utils/file-system';
import { HeaderFinderService } from '../utils/header-finder';
import { IncludeSorterService } from '../utils/include-sorter';

/**
 * Contains implementations for header-related commands
 */
export class HeaderCommands {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  /**
   * Add header file include, with option to create if it doesn't exist
   */
  public async addHeaderInclude(editor: vscode.TextEditor, createIfNotExist: boolean = false): Promise<void> {
    const config = ConfigurationManager.getConfiguration();

    // Get current file path
    const filePath = editor.document.uri.fsPath;

    // Check if it's a C/C++ source file
    if (!FileSystemService.isCppSourceFile(filePath)) {
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
      await HeaderFinderService.generateHeaderIncludePath(filePath, workspaceFolder);

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
    const insertLineIndex = IncludeSorterService.findInsertPosition(editor.document);

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
      await IncludeSorterService.sortIncludeStatements(editor);

      vscode.window.showInformationMessage(`Added ${includeStatement} to the file.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error adding include statement: ${error}`);
    }
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
    const config = ConfigurationManager.getConfiguration();

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
      // Create template content with header guard
      const headerContent = config.headerTemplate.replace(/\${filename}/g, baseNameWithoutExt);

      // Write to file using FileSystemService
      if (!FileSystemService.writeFile(headerFilePath, headerContent)) {
        throw new Error("Failed to write header file");
      }

      // Open the newly created file
      await vscode.window.showTextDocument(vscode.Uri.file(headerFilePath));

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating header file: ${error}`);
      return false;
    }
  }
  
  /**
   * Switch between header and source file
   */
  public async switchHeaderSource(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found!');
      return;
    }
    
    const filePath = editor.document.uri.fsPath;
    const fileExtension = path.extname(filePath).toLowerCase();
    const config = ConfigurationManager.getConfiguration();
    
    // Check if file is either a header or source file
    if (!FileSystemService.isCppHeaderFile(filePath) && 
        !FileSystemService.isCppSourceFile(filePath)) {
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
    const correspondingFile = await HeaderFinderService.findCorrespondingFile(
      filePath, 
      workspaceFolder,
      this.context
    );
    
    if (correspondingFile) {
      // Open the corresponding file
      const document = await vscode.workspace.openTextDocument(correspondingFile);
      await vscode.window.showTextDocument(document);
    } else {
      // Ask if user wants to create the corresponding file
      const baseNameWithoutExt = path.basename(filePath, fileExtension);
      let newFileExt: string;
      let newFileType: string;
      
      if (FileSystemService.isCppHeaderFile(filePath)) {
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
          
          // Write the file using FileSystemService
          if (!FileSystemService.writeFile(newFilePath, content)) {
            throw new Error("Failed to write file");
          }
          
          // Open the new file
          const document = await vscode.workspace.openTextDocument(newFilePath);
          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(`Error creating file: ${error}`);
        }
      }
    }
  }
}