# Docster

Adds doc comments, flags undocumented functions, and generates documentation for JavaScript, TypeScript, Dart, Python, Java, C, C#, Go, PHP, Flutter, and ADO.NET — no AI or API key required.

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/rajanpoudel.docster?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=RajanPoudel.docster)
[![Installs](https://img.shields.io/vscode-marketplace/i/rajanpoudel.docster?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=RajanPoudel.docster)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.txt)

---

## Supported Tech Stack & Comment Styles

![C](https://img.shields.io/badge/C-00599C?style=flat-square&logo=c&logoColor=white)
![C#](https://img.shields.io/badge/C%23-239120?style=flat-square&logo=c-sharp&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Dart](https://img.shields.io/badge/Dart-0175C2?style=flat-square&logo=dart&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-777BB4?style=flat-square&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)
![.NET](https://img.shields.io/badge/ADO.NET-512BD4?style=flat-square&logo=.net&logoColor=white)

| Language / Framework | Comment Style | Output Syntax |
| :--- | :--- | :--- |
| **C / C++** | `/** ... */` or `///` | Doxygen |
| **C# (.NET / ADO.NET)** | `/// <summary>...</summary>` | XML Documentation |
| **Java** | `/** ... */` | Javadoc |
| **Python** | `""" docstring """` | Google / NumPy Docstring |
| **Dart / Flutter** | `///` | Dartdoc |
| **Go** | `// Package/Function doc` | Godoc |
| **PHP** | `/** ... */` | PHPDoc |
| **JavaScript / TypeScript** | `/** ... */` | JSDoc |

---

## Quick Start

1. Install **Docster** from the VS Code Marketplace.
2. Open any code file (`.c`, `.cs`, `.java`, `.py`, `.dart`, `.go`, `.php`, `.js`, `.ts`).
3. Place your cursor on a function/method line.
4. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and select **Add Doc Comment**.

---

## Features

* **Add Doc Comment:** Inserts language-standard doc comments directly above the active function.
* **Inline Warnings:** Flags functions missing comments with subtle warnings.
* **Generate Documentation:** Creates a `DOCS.md` file for your active file.
* **Generate Project Documentation:** Scans your entire project folder and outputs a unified `DOCS.md`.

---

## How to Use

| Command | Action |
| :--- | :--- |
| `Add Doc Comment` | Insert doc block for current cursor function |
| `Generate Documentation` | Build `DOCS.md` for current open file |
| `Generate Project Documentation` | Build `DOCS.md` for whole workspace |

---

## License

Licensed under the [MIT License](LICENSE.txt).