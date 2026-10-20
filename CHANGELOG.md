## [0.1.3]

- JavaScript and TypeScript: class methods and constructors are now detected.
- Fixed typed arrow functions (`const f = (a: number): number =>`) and generic functions (`function f<T>(...)`) not being detected.
- Function signatures split over several lines are now supported in all languages. Python docstrings go after the closing `):`.
- Missing-comment warnings now update when you pause typing instead of on every keystroke.
- Removed a debug message from the console.

## [0.1.1]

- Commands renamed from `autoDoc.*` to `docster.*`.
- New settings: Python docstring style (Google or NumPy) and warnings on/off.
- Fixed Python and Dart parameters with commas in type hints.
- Commented-out functions in JavaScript and TypeScript no longer get warnings.
- Generate Documentation now opens a preview and no longer overwrites DOCS.md.
- Removed the default keyboard shortcut, which clashed with the Dart/Flutter extension.