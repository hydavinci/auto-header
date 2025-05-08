import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../config/configuration';

/**
 * FileSystemService provides utilities for file system operations
 * with optimized caching to reduce file system access operations
 */
export class FileSystemService {
  private static fsCache: Map<string, boolean> = new Map();
  
  /**
   * Check if a file exists with caching to reduce file system operations
   * @param filePath Path to check for existence
   * @returns Boolean indicating if file exists
   */
  public static fileExists(filePath: string): boolean {
    // Check cache first
    if (this.fsCache.has(filePath)) {
      return this.fsCache.get(filePath) || false;
    }

    try {
      // Check file system and cache the result
      const exists = fs.existsSync(filePath);
      this.fsCache.set(filePath, exists);
      return exists;
    } catch (error) {
      console.error(`Error checking if file exists: ${error}`);
      return false;
    }
  }

  /**
   * Clear file system cache to ensure fresh data
   * This should be called when files are created or deleted
   */
  public static clearCache(): void {
    this.fsCache.clear();
  }

  /**
   * Check if file is a C/C++ source file
   * @param filePath Path to check
   * @returns Boolean indicating if file is a C/C++ source file
   */
  public static isCppSourceFile(filePath: string): boolean {
    if (!filePath) {
      return false;
    }

    const config = ConfigurationManager.getConfiguration();
    const fileExtension = path.extname(filePath).toLowerCase();
    return config.supportedExtensions.includes(fileExtension);
  }
  
  /**
   * Check if file is a C/C++ header file
   * @param filePath Path to check
   * @returns Boolean indicating if file is a C/C++ header file
   */
  public static isCppHeaderFile(filePath: string): boolean {
    if (!filePath) {
      return false;
    }

    const config = ConfigurationManager.getConfiguration();
    const fileExtension = path.extname(filePath).toLowerCase();
    return config.headerExtensions.includes(fileExtension);
  }

  /**
   * Create a directory recursively if it doesn't exist
   * @param dirPath Directory path to create
   * @returns Boolean indicating success
   */
  public static ensureDirectoryExists(dirPath: string): boolean {
    if (this.fileExists(dirPath)) {
      return true;
    }
    
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      this.clearCache(); // Clear cache after creating directory
      return true;
    } catch (error) {
      console.error(`Error creating directory: ${error}`);
      return false;
    }
  }

  /**
   * Write content to a file, ensuring the directory exists
   * @param filePath File path to write to
   * @param content Content to write
   * @returns Boolean indicating success
   */
  public static writeFile(filePath: string, content: string): boolean {
    try {
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      if (!this.ensureDirectoryExists(dirPath)) {
        return false;
      }
      
      // Write file content
      fs.writeFileSync(filePath, content);
      
      // Clear cache after writing
      this.clearCache();
      return true;
    } catch (error) {
      console.error(`Error writing file: ${error}`);
      return false;
    }
  }
}