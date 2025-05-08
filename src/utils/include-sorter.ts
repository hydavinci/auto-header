import * as vscode from 'vscode';
import { ConfigurationManager } from '../config/configuration';

/**
 * Interface representing an include statement for sorting
 */
interface IncludeStatement {
  lineNumber: number;
  text: string;
  isSystemInclude: boolean;
  includePath: string;
}

/**
 * IncludeSorterService provides functionality for sorting include statements
 * with support for different sorting strategies
 */
export class IncludeSorterService {
  /**
   * Find appropriate insertion position for new include statements
   * (skips comments at the top of the file)
   */
  public static findInsertPosition(document: vscode.TextDocument): number {
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
   * Sort include statements in the document
   * @param editor The text editor to sort includes in
   * @param force Force sorting even if sorting is disabled in settings
   * @returns Boolean indicating if any sorting was performed
   */
  public static async sortIncludeStatements(editor: vscode.TextEditor, force: boolean = false): Promise<boolean> {
    const config = ConfigurationManager.getConfiguration();

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
          isSystemInclude: lines[i].includes('#include <'),
          includePath: match[1]
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

    // Sort the include statements based on configuration
    return await this.performSort(editor, includeStatements, lines, config.groupIncludesByType);
  }

  /**
   * Perform the actual sorting of include statements
   * @param editor The text editor containing includes
   * @param includeStatements Array of include statements to sort
   * @param lines All lines in the document
   * @param groupByType Whether to group includes by type (system vs. user)
   * @returns Boolean indicating if sorting was performed
   */
  private static async performSort(
    editor: vscode.TextEditor,
    includeStatements: IncludeStatement[],
    lines: string[],
    groupByType: boolean
  ): Promise<boolean> {
    // Sort the include statements according to the desired rules
    includeStatements.sort((a, b) => {
      // If grouping by type is enabled, separate system and user includes
      if (groupByType) {
        // First sort by system vs. user includes
        if (a.isSystemInclude && !b.isSystemInclude) {
          return -1;
        }
        if (!a.isSystemInclude && b.isSystemInclude) {
          return 1;
        }
      }

      // Then sort alphabetically by the actual include path
      return a.includePath.localeCompare(b.includePath);
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
}