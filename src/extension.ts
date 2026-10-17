import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand('autoDoc.addComment', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const line = editor.selection.active.line;
    const text = editor.document.lineAt(line).text;

    const match =
      text.match(/function\s+(\w+)\s*\(([^)]*)\)/) ||
      text.match(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/);

    if (!match) {
      vscode.window.showWarningMessage('Put your cursor on a function line.');
      return;
    }

    const params = match[2]
      .split(',')
      .map(p => p.trim().split(/[:=]/)[0].trim())
      .filter(Boolean);

    const indent = text.match(/^\s*/)![0];
    const comment =
      `${indent}/**\n` +
      `${indent} * Description of ${match[1]}\n` +
      `${indent} *\n` +
      params.map(p => `${indent} * @param ${p}\n`).join('') +
      `${indent} * @returns\n` +
      `${indent} */\n`;

    editor.edit(edit => edit.insert(new vscode.Position(line, 0), comment));
  });

  context.subscriptions.push(cmd);
}

export function deactivate() {}