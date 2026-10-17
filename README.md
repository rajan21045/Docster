# Auto Doc

Add doc comments, find undocumented functions, and generate documentation. No AI or API key needed.

## Features

- **Add Doc Comment**: puts a comment template above a function (or inside it, for Python), with its parameters filled in.
- **Warnings**: functions without a comment get a yellow underline. Press `Ctrl+.` and choose **Add doc comment** to fix it.
- **Generate Documentation**: creates a `DOCS.md` for the open file.
- **Generate Project Documentation**: creates one `DOCS.md` for every file in your folder.

## Supported languages

| Language | Comment style |
|---|---|
| JavaScript / TypeScript | `/** ... */` JSDoc |
| Dart | `///` |
| Python | `"""docstring"""` |

## How to use

1. Open a file and click on a function line.
2. Press `Ctrl+Shift+P` and run **Add Doc Comment**.
3. Run **Generate Documentation** or **Generate Project Documentation** to build `DOCS.md`.

Open a folder first (File > Open Folder), or the docs will open as an unsaved page instead of being saved.

## Known limitations

- Functions are found with simple pattern matching, so functions whose parameters span several lines are not detected.
- Arrow functions with a single unparenthesized parameter (`x => x * 2`) are not detected.

## License

MIT