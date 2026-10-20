# Docster

Adds doc comments, flags undocumented functions, and generates documentation for JavaScript, TypeScript, Dart, Python, Java, C, C++, C#, Go and PHP. No AI and no API key required.

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/RajanPoudel.docster?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=RajanPoudel.docster)
[![Installs](https://img.shields.io/vscode-marketplace/i/RajanPoudel.docster?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=RajanPoudel.docster)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

<!-- Add screenshots or a short GIF here, for example:
![Quick fix](images/quickfix.png)
-->

## Supported Languages and Comment Styles

| Language | Comment Style | Output |
| :--- | :--- | :--- |
| **JavaScript / TypeScript** (including JSX and TSX) | `/** ... */` | JSDoc |
| **Python** | `""" docstring """` | Google or NumPy docstring |
| **Dart / Flutter** | `///` | Dartdoc |
| **Java** | `/** ... */` | Javadoc |
| **C / C++** | `/** ... */` | Doxygen-style block |
| **C#** | `/// <summary>...</summary>` | XML documentation |
| **Go** | `// Name ...` | Godoc |
| **PHP** | `/** ... */` | PHPDoc |

---

## Features

* **Add Doc Comment:** inserts a language-standard comment for the function under your cursor, with the parameters already listed.
* **Missing comment warnings:** functions without a doc comment get a warning underline.
* **Quick fix:** click the lightbulb (or press `Ctrl+.`) on a warning and choose **Add doc comment**.
* **Generate Documentation:** builds Markdown documentation for the current file and opens it as a preview.
* **Generate Project Documentation:** scans your workspace and saves one `DOCS.md` in the project folder.

---

## How to Use

1. Open a code file in one of the supported languages.
2. Put your cursor on a function line.
3. Right-click and choose **Add Doc Comment**, or press `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac) and run **Docster: Add Doc Comment**.

| Command | What it does |
| :--- | :--- |
| `Docster: Add Doc Comment` | Adds a doc comment for the function under the cursor |
| `Docster: Generate Documentation` | Shows Markdown docs for the current file |
| `Docster: Generate Project Documentation` | Saves `DOCS.md` for the whole workspace |

There is no default keyboard shortcut, to avoid clashing with other extensions. You can add your own in **Keyboard Shortcuts** by searching for "Docster".

---

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `docster.pythonDocstringStyle` | `google` | Docstring style for Python: `google` or `numpy` |
| `docster.warnMissingComments` | `true` | Show a warning on functions with no doc comment |

---

## Known Limitations

* Docster reads signatures with simple pattern matching, so very unusual formatting can be missed. A signature split over several lines is read up to 12 lines.
* In JavaScript and TypeScript, `function` declarations, `const name = (...) =>` arrow functions and class methods are detected. Arrow functions assigned as class properties are not detected yet.
* Methods with callback-typed parameters, like `(cb: (x: number) => void)`, are not detected yet.
* Destructured parameters in JavaScript are named `param1`, `param2` and so on. Rename them by hand.
* Generated comments contain placeholder text (`Description of ...`) for you to fill in.

---

## Feedback

Found a bug or have an idea? Please open an issue on [GitHub](https://github.com/rajan21045/Docster/issues).

---

## License

Licensed under the [MIT License](LICENSE).