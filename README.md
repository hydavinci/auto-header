# Auto Header

A simple and efficient VS Code extension for automatically managing header file includes in C/C++ files.

## Features

- Automatically add corresponding `.h` header files to C/C++ source files
- Quick access through the context menu
- Status bar button for easy access
- Keyboard shortcut support with `Ctrl+K Ctrl+H`
- Ability to create non-existent header files automatically
- Preserves comments at the top of the file when adding include statements
- Highly customizable with various configuration options

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

## Example

For a source file named `example.cpp`, the extension will:

1. Look for an `example.h` file in the same directory
2. Add `#include "example.h"` at the top of the file
3. If the header file doesn't exist and the user chooses to create it, generate a new header file with a basic structure

## Version History

### 0.0.1
- Initial release
- Support for adding header files to C/C++ source files
- Support for creating non-existent header files
- Custom configuration options
