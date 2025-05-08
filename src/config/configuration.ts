import * as vscode from 'vscode';

/**
 * Configuration interface for better type checking and centralized configuration access
 */
export interface AutoHeaderConfig {
  supportedExtensions: string[];
  headerExtensions: string[];
  insertEmptyLineAfter: boolean;
  includeFormat: 'quotes' | 'brackets';
  headerTemplate: string;
  askBeforeCreating: boolean;
  sortIncludes: boolean;
  cacheDuration: number;
  groupIncludesByType: boolean;
}

/**
 * ConfigurationManager class responsible for fetching and caching VS Code extension configuration
 */
export class ConfigurationManager {
  private static configCache: AutoHeaderConfig | null = null;
  private static configLastUpdate: number = 0;

  /**
   * Get extension configuration with caching for improved performance
   */
  public static getConfiguration(): AutoHeaderConfig {
    // Get cache duration from configuration or use default
    const cacheDuration = vscode.workspace.getConfiguration('autoHeader')
      .get<number>('cacheDuration', 5000);
    
    // Use cached configuration if available and not too old
    const now = Date.now();
    if (this.configCache && now - this.configLastUpdate < cacheDuration) {
      return this.configCache;
    }

    const config = vscode.workspace.getConfiguration('autoHeader');
    this.configCache = {
      supportedExtensions: config.get<string[]>('supportedExtensions', ['.c', '.cpp', '.cc', '.cxx']),
      headerExtensions: config.get<string[]>('headerExtensions', ['.h', '.hpp', '.hxx']),
      insertEmptyLineAfter: config.get<boolean>('insertEmptyLineAfter', true),
      includeFormat: config.get<string>('includeFormat', 'quotes') as 'quotes' | 'brackets',
      headerTemplate: config.get<string>('headerTemplate', '#pragma once\n\n// Header file for ${filename}\n\n'),
      askBeforeCreating: config.get<boolean>('askBeforeCreating', true),
      sortIncludes: config.get<boolean>('sortIncludes', false),
      cacheDuration: cacheDuration,
      groupIncludesByType: config.get<boolean>('groupIncludesByType', true)
    };

    this.configLastUpdate = now;
    return this.configCache;
  }

  /**
   * Reset configuration cache when configuration changes
   */
  public static resetCache(): void {
    this.configCache = null;
  }
}