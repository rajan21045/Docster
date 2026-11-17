
# Changelog

All notable changes to Docster are documented here.

## [0.1.5]

### Fixed
- Fixed Generate Project Documentation opening every file as an editor and flooding the Problems panel.
- Python docstrings now respect the editor's indentation settings (tabs or spaces).
- Warnings are now displayed only for real files, excluding the Output panel and diff views.
- Fixed the copyright line in the LICENSE file.

### Added
- Added `npm run test:unit` for fast parser unit tests.

## [0.1.4]

### Refactored & Improved
- **Modularized Language Parsers:** Separated individual language providers, regex patterns, comment builders, and parsing logic from `src/extension.ts` into dedicated modules to improve maintainability and extensibility.
- **Enhanced Test Suite:** Replaced placeholder tests in `src/test/extension.test.ts` with comprehensive unit tests covering signature extraction, docstring generation, and diagnostic triggers.
- **Improved Parsing Reliability:** Introduced structured token parsing alternatives to reduce limitations associated with regex-based function signature matching, including multi-line signatures and destructured arguments.

## [0.1.3]

### Fixed & Improved
- JavaScript and TypeScript class methods and constructors are now detected.
- Fixed detection of typed arrow functions and generic functions.
- Added support for multi-line function signatures across all supported languages.
- Python docstrings are now inserted after the closing `):` of multi-line function signatures.
- Missing-comment warnings now update when you pause typing instead of on every keystroke.
- Removed an unnecessary debug message from the console.

## [0.1.1]

### Changed
- Renamed commands from `autoDoc.*` to `docster.*`.
- Added Python docstring style settings (Google or NumPy).
- Added an option to enable or disable missing-comment warnings.
- Removed the default keyboard shortcut to avoid conflicts with the Dart/Flutter extension.

### Fixed
- Fixed Python and Dart parameter parsing when type hints contain commas.
- Commented-out JavaScript and TypeScript functions no longer trigger missing-comment warnings.
- Generate Documentation now opens a preview instead of directly overwriting `DOCS.md`.
