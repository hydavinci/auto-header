# Auto Header

A simple and efficient VS Code extension for automatically managing header file includes in C/C++ files.

## Features

- Automatically add corresponding `.h` header files to C/C++ source files
- Quick access through the context menu
- Status bar button for easy access
- Keyboard shortcut support with `Ctrl+K Ctrl+H`
- Switch between header and source files with `F4` key
- Ability to create non-existent header files automatically
- Preserves comments at the top of the file when adding include statements
- Highly customizable with various configuration options
- Include statement sorting capability

## Usage

### Adding Header Files

When editing a C/C++ source file, you can add the corresponding header file in several ways:

1. Press the keyboard shortcut `Ctrl+K Ctrl+H`
2. Click the "Add Header" button in the status bar
3. Right-click in the editor and select "Include Header File"
4. Open the command palette (Ctrl+Shift+P) and type "Include Header File"

The extension will automatically find the header file with the same name as the current source file and add an appropriate `#include` statement at the top of the file.

### Creating and Adding Header Files

If the header file doesn't exist, you can:

1. Right-click in the editor and select "Create and Include Header File"
2. Open the command palette (Ctrl+Shift+P) and type "Create and Include Header File"

The extension will create a new header file and automatically add basic header guards and structure.

### Switching Between Header and Source Files

You can quickly switch between a header (.h) file and its corresponding source file (.c, .cpp, .cc) using:

1. Press the `F4` key when editing either a header or source file
2. Right-click and select "Switch Between Header and Source"
3. Open the command palette (Ctrl+Shift+P) and type "Switch Between Header and Source"

If the corresponding file doesn't exist, the extension will ask if you want to create it automatically.

### Sorting Include Statements

You can sort include statements in your file by:

1. Right-click and select "Sort Include Statements"
2. Open the command palette (Ctrl+Shift+P) and type "Sort Include Statements"

This will organize includes with system headers (`<>`) first, followed by user headers (`""`), all sorted alphabetically.

## Configuration Options

You can customize the following options in settings:

| Setting | Description | Default Value |
| --- | --- | --- |
| `autoHeader.supportedExtensions` | Supported C/C++ source file extensions | `[".c", ".cpp", ".cc"]` |
| `autoHeader.headerExtensions` | Header file extensions to search for, ordered by priority | `[".h"]` |
| `autoHeader.insertEmptyLineAfter` | Add an empty line after the inserted include statement | `true` |
| `autoHeader.includeFormat` | Include format for header files, quotes uses `""`, brackets uses `<>` | `"quotes"` |
| `autoHeader.headerTemplate` | Template for new header files, use `${filename}` as a placeholder for the file name | `"#pragma once\n\n// Header file for ${filename}\n\n"` |
| `autoHeader.askBeforeCreating` | Ask user before creating a new header file | `true` |
| `autoHeader.sortIncludes` | Automatically sort include statements after adding a new header | `false` |

## Example

For a source file named `example.cpp`, the extension will:

1. Look for an `example.h` file in the same directory
2. Add `#include "example.h"` at the top of the file
3. If the header file doesn't exist and the user chooses to create it, generate a new header file with a basic structure

When pressing `F4` while in `example.cpp`, the extension will open `example.h` (or offer to create it if it doesn't exist).

## Version History

### 0.0.2
- Added F4 key functionality to switch between header and source files
- Added include statement sorting capability
- Improved header detection with multiple search strategies
- Fixed performance issues with configuration caching

### 0.0.1
- Initial release
- Support for adding header files to C/C++ source files
- Support for creating non-existent header files
- Custom configuration options
