# Change Log

All notable changes to the "cpp-auto-header" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.3] - 2025-05-08

### Added
- Complete code restructuring with modular architecture
- New specialized service classes for improved organization
- Comprehensive JSDoc documentation throughout the codebase
- Enhanced type safety with dedicated interfaces
- Improved error handling and user feedback

### Changed
- Significantly improved performance through optimized caching
- Enhanced build process with better tree-shaking and minification
- Reorganized code into logical modules with clear responsibilities
- Improved header detection algorithms with better caching
- Better status bar integration with more accurate visibility control

### Fixed
- Memory usage issues through better resource management
- Build size optimization for faster loading
- Potential race conditions in file system operations
- Edge cases in header file detection

## [0.0.2] - 2025-05-07

### Added
- Support for more file extensions (.cxx, .hpp, .hxx)
- New configuration option `cacheDuration` to control file system caching
- New configuration option `groupIncludesByType` for organizing includes
- Bundle analysis capability for extension developers
- Better caching of file system operations for improved performance

### Changed
- Improved header/source file detection algorithms
- Enhanced include statement sorting with support for grouping by type
- Optimized file system operations to reduce redundant checks
- Updated configuration type definitions for better type safety
- Cached corresponding file lookup to improve switch performance

### Fixed
- File system performance bottlenecks
- Type safety issues in configuration handling
- Redundant directory checks in header file search

## [0.0.1] - Initial release

- Initial release of Auto Header
- Support for adding header files to C/C++ source files
- Support for creating non-existent header files
- Custom configuration options