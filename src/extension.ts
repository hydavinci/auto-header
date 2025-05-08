// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { ConfigurationManager } from './config/configuration';
import { HeaderCommands } from './commands/header-commands';
import { IncludeSorterService } from './utils/include-sorter';

/**
 * Main class that handles the Auto Header extension functionality
 */
class AutoHeaderExtension {
  private statusBarItem: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;
  private headerCommands: HeaderCommands;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.headerCommands = new HeaderCommands(context);

    // Initialize status bar
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0
    );
    this.statusBarItem.text = "$(file-add) Include Header";
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

      await this.headerCommands.addHeaderInclude(editor, false);
    });

    // Register command: Create and add header file
    const disposable2 = vscode.commands.registerCommand('auto-header.createAndInclude', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
      }

      await this.headerCommands.addHeaderInclude(editor, true);
    });

    // Register command: Sort includes in current file
    const disposable3 = vscode.commands.registerCommand('auto-header.sortIncludes', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
      }

      if (await IncludeSorterService.sortIncludeStatements(editor, true)) {
        vscode.window.showInformationMessage('Include statements have been sorted');
      } else {
        vscode.window.showInformationMessage('No include statements to sort');
      }
    });

    // Register command: Switch between header and source files
    const disposable4 = vscode.commands.registerCommand('auto-header.switchHeaderSource', async () => {
      await this.headerCommands.switchHeaderSource();
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
          ConfigurationManager.resetCache();
        }
      })
    );
  }

  /**
   * Update status bar item visibility
   */
  private updateStatusBarVisibility(editor: vscode.TextEditor | undefined): void {
    if (editor && editor.document.uri.fsPath) {
      const filePath = editor.document.uri.fsPath;
      const config = ConfigurationManager.getConfiguration();
      const fileExtension = filePath ? filePath.substring(filePath.lastIndexOf('.')).toLowerCase() : '';
      
      if (config.supportedExtensions.includes(fileExtension)) {
        this.statusBarItem.show();
      } else {
        this.statusBarItem.hide();
      }
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
