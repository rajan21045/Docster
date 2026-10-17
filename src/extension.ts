import * as vscode from 'vscode';

const LANGUAGES = ['javascript', 'typescript'];

const FUNCTION_PATTERNS = [
  /function\s+(\w+)\s*\(([^)]*)\)/,
  /(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
];

interface ParsedFunction {
  name: string;
  params: string[];
}

function parseFunction(text: string): ParsedFunction | undefined {
  for (const pattern of FUNCTION_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const params = m[2]
        .split(',')
        .map(p => p.trim().split(/[:=]/)[0].trim())
        .filter(Boolean);
      return { name: m[1], params };
    }
  }
  return undefined;
}

function buildComment(indent: string, fn: ParsedFunction): string {
  return (
    `${indent}/**\n` +
    `${indent} * Description of ${fn.name}\n` +
    `${indent} *\n` +
    fn.params.map(p => `${indent} * @param ${p}\n`).join('') +
    `${indent} * @returns\n` +
    `${indent} */\n`
  );
}

function hasComment(doc: vscode.TextDocument, line: number): boolean {
  return line > 0 && doc.lineAt(line - 1).text.trim().endsWith('*/');
}

function updateDiagnostics(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
) {
  if (!LANGUAGES.includes(doc.languageId)) {
    return;
  }
  const diagnostics: vscode.Diagnostic[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    if (parseFunction(line.text) && !hasComment(doc, i)) {
      const d = new vscode.Diagnostic(
        line.range,
        'Function has no doc comment',
        vscode.DiagnosticSeverity.Warning
      );
      d.source = 'auto-doc';
      diagnostics.push(d);
    }
  }
  collection.set(doc.uri, diagnostics);
}

class DocFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    doc: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== 'auto-doc') {
        continue;
      }
      const lineNo = d.range.start.line;
      const text = doc.lineAt(lineNo).text;
      const fn = parseFunction(text);
      if (!fn) {
        continue;
      }
      const indent = text.match(/^\s*/)![0];
      const action = new vscode.CodeAction(
        'Add doc comment',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [d];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(
        doc.uri,
        new vscode.Position(lineNo, 0),
        buildComment(indent, fn)
      );
      actions.push(action);
    }
    return actions;
  }
}

function getDescription(doc: vscode.TextDocument, fnLine: number): string {
  if (!hasComment(doc, fnLine)) {
    return '';
  }
  const lines: string[] = [];
  for (let i = fnLine - 1; i >= 0; i--) {
    const t = doc.lineAt(i).text.trim();
    if (t.startsWith('/**')) {
      break;
    }
    const clean = t.replace(/^\*+\/?\s?/, '').trim();
    if (clean && !clean.startsWith('@') && !clean.startsWith('Description of ')) {
      lines.unshift(clean);
    }
  }
  return lines.join(' ');
}

async function generateDocs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const doc = editor.document;
  const fileName = doc.uri.path.split('/').pop();
  let md = `# ${fileName}\n\n`;
  let count = 0;

  for (let i = 0; i < doc.lineCount; i++) {
    const fn = parseFunction(doc.lineAt(i).text);
    if (!fn) {
      continue;
    }
    count++;
    const description = getDescription(doc, i) || '_No description yet._';
    md += `## ${fn.name}(${fn.params.join(', ')})\n\n${description}\n\n`;
    if (fn.params.length) {
      md += '**Parameters**\n\n';
      md += fn.params.map(p => `- \`${p}\``).join('\n') + '\n\n';
    }
  }

  if (count === 0) {
    vscode.window.showWarningMessage('No functions found in this file.');
    return;
  }

  const folder =
    vscode.workspace.getWorkspaceFolder(doc.uri) ??
    vscode.workspace.workspaceFolders?.[0];

  // No folder open: show a temporary page like before
  if (!folder) {
    const out = await vscode.workspace.openTextDocument({
      content: md,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(out, vscode.ViewColumn.Beside);
    return;
  }

  // Folder open: save the result as DOCS.md
  const target = vscode.Uri.joinPath(folder.uri, 'DOCS.md');
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(md));
  const saved = await vscode.workspace.openTextDocument(target);
  await vscode.window.showTextDocument(saved, vscode.ViewColumn.Beside);
}

export function activate(context: vscode.ExtensionContext) {
  const collection = vscode.languages.createDiagnosticCollection('auto-doc');

  const cmd = vscode.commands.registerCommand('autoDoc.addComment', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const lineNo = editor.selection.active.line;
    const text = editor.document.lineAt(lineNo).text;
    const fn = parseFunction(text);
    if (!fn) {
      vscode.window.showWarningMessage('Put your cursor on a function line.');
      return;
    }
    const indent = text.match(/^\s*/)![0];
    editor.edit(edit =>
      edit.insert(new vscode.Position(lineNo, 0), buildComment(indent, fn))
    );
  });

  context.subscriptions.push(
    collection,
    cmd,
    vscode.commands.registerCommand('autoDoc.generateDocs', generateDocs),
    vscode.languages.registerCodeActionsProvider(LANGUAGES, new DocFixProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.workspace.onDidOpenTextDocument(d => updateDiagnostics(d, collection)),
    vscode.workspace.onDidChangeTextDocument(e =>
      updateDiagnostics(e.document, collection)
    ),
    vscode.workspace.onDidCloseTextDocument(d => collection.delete(d.uri))
  );

  vscode.workspace.textDocuments.forEach(d => updateDiagnostics(d, collection));
}

export function deactivate() {}