import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService } from '../utils/file-system';
import { ConfigurationManager } from '../config/configuration';

/**
 * Result interface for header file finding operations
 */
export interface HeaderFindResult {
  headerIncludePath: string;
  headerFilePath: string;
  baseNameWithoutExt: string;
  foundHeader: boolean;
}

/**
 * HeaderFinderService handles all operations related to finding and generating header file paths
 */
export class HeaderFinderService {
  /**
   * Find header file using multiple strategies
   * Significantly improves header detection by trying various common patterns
   */
  public static async findHeaderFile(
    filePath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    baseNameWithoutExt: string
  ): Promise<{
    headerIncludePath: string;
    headerFilePath: string;
    foundHeader: boolean;
  }> {
    const config = ConfigurationManager.getConfiguration();
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
  private static async findHeaderInDirectory(
    directory: string,
    baseNameWithoutExt: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<{
    headerIncludePath: string;
    headerFilePath: string;
    foundHeader: boolean;
  }> {
    const config = ConfigurationManager.getConfiguration();

    // Skip if the directory doesn't exist
    if (!FileSystemService.fileExists(directory)) {
      return { headerIncludePath: '', headerFilePath: '', foundHeader: false };
    }

    // Try each possible header extension
    for (const ext of config.headerExtensions) {
      const headerFilePath = path.join(directory, baseNameWithoutExt + ext);

      if (FileSystemService.fileExists(headerFilePath)) {
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
   * Generate header file include path with complete information
   */
  public static async generateHeaderIncludePath(
    filePath: string, 
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<HeaderFindResult> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const baseNameWithoutExt = path.basename(filePath, fileExtension);

    // Use the enhanced header detection algorithm
    const { headerIncludePath, headerFilePath, foundHeader } =
      await this.findHeaderFile(filePath, workspaceFolder, baseNameWithoutExt);

    return { 
      headerIncludePath, 
      headerFilePath, 
      baseNameWithoutExt, 
      foundHeader 
    };
  }

  /**
   * Find the corresponding source file for a header file
   */
  public static async findMatchingSourceFile(
    fileDir: string, 
    baseNameWithoutExt: string, 
    supportedExtensions: string[]
  ): Promise<string | undefined> {
    // Strategy 1: Same directory (most common case)
    for (const srcExt of supportedExtensions) {
      const possibleSourceFile = path.join(fileDir, baseNameWithoutExt + srcExt);
      if (FileSystemService.fileExists(possibleSourceFile)) {
        return possibleSourceFile;
      }
    }
    
    // Strategy 2: Check for src directory from include
    const includePattern = /[\/\\]include[\/\\]/;
    if (includePattern.test(fileDir)) {
      // Try replacing 'include' with 'src' in the path
      const srcDir = fileDir.replace(includePattern, 
        process.platform === 'win32' ? '\\src\\' : '/src/');
      
      if (FileSystemService.fileExists(srcDir)) {
        for (const srcExt of supportedExtensions) {
          const possibleSourceFile = path.join(srcDir, baseNameWithoutExt + srcExt);
          if (FileSystemService.fileExists(possibleSourceFile)) {
            return possibleSourceFile;
          }
        }
      }
    }
    
    // Strategy 3: Search for common locations (src directory at same level)
    const parentDir = path.dirname(fileDir);
    const srcDir = path.join(parentDir, 'src');
    
    if (FileSystemService.fileExists(srcDir)) {
      for (const srcExt of supportedExtensions) {
        const possibleSourceFile = path.join(srcDir, baseNameWithoutExt + srcExt);
        if (FileSystemService.fileExists(possibleSourceFile)) {
          return possibleSourceFile;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Find corresponding pair file (.h -> .cc or .cc -> .h)
   */
  public static async findCorrespondingFile(
    filePath: string, 
    workspaceFolder: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ): Promise<string | undefined> {
    const config = ConfigurationManager.getConfiguration();
    const fileExtension = path.extname(filePath).toLowerCase();
    const baseNameWithoutExt = path.basename(filePath, fileExtension);
    const fileDir = path.dirname(filePath);
    
    // Create a cache key for this lookup to avoid redundant file system operations
    const cacheKey = `${filePath}_corresponding`;
    const cachedPath = context.workspaceState.get<string>(cacheKey);
    
    // Return cached path if it exists and the file still exists
    if (cachedPath && FileSystemService.fileExists(cachedPath)) {
      return cachedPath;
    }
    
    // If current file is a header file, look for a source file
    if (config.headerExtensions.includes(fileExtension)) {
      // Try to find a source file with matching name using optimized search
      const sourceFile = await this.findMatchingSourceFile(fileDir, baseNameWithoutExt, config.supportedExtensions);
      
      if (sourceFile) {
        // Cache the result for future lookups
        context.workspaceState.update(cacheKey, sourceFile);
        return sourceFile;
      }
    } 
    // If current file is a source file, look for a header file
    else if (config.supportedExtensions.includes(fileExtension)) {
      // First try to find the header file using our existing header detection
      const { headerFilePath, foundHeader } = 
        await this.findHeaderFile(filePath, workspaceFolder, baseNameWithoutExt);
      
      if (foundHeader) {
        // Cache the result for future lookups
        context.workspaceState.update(cacheKey, headerFilePath);
        return headerFilePath;
      }
    }
    
    return undefined;
  }
}