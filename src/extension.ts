import * as vscode from 'vscode';
import { buildFileDocs } from './core/docs';
import { BuildOptions } from './core/types';
import { getSupport, LANGUAGE_IDS, languageIdForPath } from './languages';

const DEBOUNCE_MS = 300;
const ANALYZED_SCHEMES = ['file', 'untitled'];

// ---------- Helpers ----------

function isAnalyzable(doc: vscode.TextDocument): boolean {
	return ANALYZED_SCHEMES.includes(doc.uri.scheme);
}

function linesOf(doc: vscode.TextDocument): string[] {
	return doc.getText().split(/\r?\n/);
}

// Uses the editor's own indentation settings (tabs or N spaces) instead of a hardcoded 4 spaces
function buildOptions(doc: vscode.TextDocument): BuildOptions {
	const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
	const tabSize = typeof editor?.options.tabSize === 'number' ? editor.options.tabSize : 4;
	const insertSpaces = editor?.options.insertSpaces !== false;
	const pythonStyle = vscode.workspace
		.getConfiguration('docster')
		.get<'google' | 'numpy'>('pythonDocstringStyle', 'google');
	return { indentUnit: insertSpaces ? ' '.repeat(tabSize) : '\t', pythonStyle };
}

// ---------- Diagnostics ----------

function updateDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
	const support = getSupport(doc.languageId);
	if (!support || !isAnalyzable(doc)) {
		return;
	}

	const enabled = vscode.workspace.getConfiguration('docster').get<boolean>('warnMissingComments', true);
	if (!enabled) {
		collection.delete(doc.uri);
		return;
	}

	const lines = linesOf(doc);
	const diagnostics: vscode.Diagnostic[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (support.parse(lines[i]) && !support.hasComment(lines, i)) {
			const range = new vscode.Range(i, 0, i, lines[i].length);
			const d = new vscode.Diagnostic(range, 'Function has no doc comment', vscode.DiagnosticSeverity.Warning);
			d.source = 'docster';
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
		const support = getSupport(doc.languageId);
		if (!support) {
			return [];
		}
		const lines = linesOf(doc);
		const actions: vscode.CodeAction[] = [];
		for (const d of context.diagnostics) {
			if (d.source !== 'docster') {
				continue;
			}
			const lineNo = d.range.start.line;
			const fn = support.parse(lines[lineNo] ?? '');
			if (!fn) {
				continue;
			}
			const indent = lines[lineNo].match(/^\s*/)![0];
			const action = new vscode.CodeAction('Add doc comment', vscode.CodeActionKind.QuickFix);
			action.diagnostics = [d];
			action.isPreferred = true;
			action.edit = new vscode.WorkspaceEdit();
			action.edit.insert(
				doc.uri,
				new vscode.Position(support.insertLine(lines, lineNo), 0),
				support.build(indent, fn, buildOptions(doc))
			);
			actions.push(action);
		}
		return actions;
	}
}

// ---------- Commands ----------

// Saves DOCS.md in the folder, or shows an unsaved page if no folder is given
async function outputDocs(md: string, folder: vscode.WorkspaceFolder | undefined) {
	if (!folder) {
		const out = await vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
		await vscode.window.showTextDocument(out, vscode.ViewColumn.Beside);
		return;
	}
	const target = vscode.Uri.joinPath(folder.uri, 'DOCS.md');
	await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(md));
	const saved = await vscode.workspace.openTextDocument(target);
	await vscode.window.showTextDocument(saved, vscode.ViewColumn.Beside);
}

// Single-file docs open as an unsaved preview, so they never overwrite DOCS.md
async function generateDocs() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const doc = editor.document;
	const support = getSupport(doc.languageId);
	if (!support) {
		vscode.window.showWarningMessage(`This language is not supported yet. Supported: ${LANGUAGE_IDS.join(', ')}`);
		return;
	}
	const fileName = doc.uri.path.split('/').pop() ?? 'file';
	const { md, count } = buildFileDocs(linesOf(doc), support, fileName, 1);
	if (count === 0) {
		vscode.window.showWarningMessage('No functions found in this file.');
		return;
	}
	await outputDocs(md, undefined);
}

// Project docs are saved to DOCS.md in the first workspace folder.
// Files are read straight from disk, so they are never opened as editors
// and never trigger the missing-comment diagnostics.
async function generateProjectDocs() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('Open a folder first (File > Open Folder).');
		return;
	}

	const files = await vscode.workspace.findFiles(
		'**/*.{js,jsx,ts,tsx,dart,py,java,c,h,cpp,cc,hpp,cs,go,php}',
		'**/{node_modules,out,dist,build,.git,.dart_tool,venv,.venv,__pycache__,vendor,bin,obj,target}/**',
		500
	);
	files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

	let body = '';
	let totalFunctions = 0;
	let totalFiles = 0;
	const decoder = new TextDecoder('utf-8');

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Generating project documentation...' },
		async () => {
			for (const uri of files) {
				const rel = vscode.workspace.asRelativePath(uri, false);
				if (rel.endsWith('.d.ts')) {
					continue;
				}
				const languageId = languageIdForPath(rel);
				const support = languageId ? getSupport(languageId) : undefined;
				if (!support) {
					continue;
				}
				const bytes = await vscode.workspace.fs.readFile(uri);
				const result = buildFileDocs(decoder.decode(bytes).split(/\r?\n/), support, rel, 2);
				if (result.count === 0) {
					continue;
				}
				body += result.md;
				totalFunctions += result.count;
				totalFiles++;
			}
		}
	);

	if (totalFunctions === 0) {
		vscode.window.showWarningMessage('No functions found in this project.');
		return;
	}
	const header = `# Project Documentation\n\n${totalFunctions} functions in ${totalFiles} files.\n\n`;
	await outputDocs(header + body, folder);
}

function addComment() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const doc = editor.document;
	const support = getSupport(doc.languageId);
	if (!support) {
		vscode.window.showWarningMessage('This language is not supported yet.');
		return;
	}
	const lines = linesOf(doc);
	const lineNo = editor.selection.active.line;
	const fn = support.parse(lines[lineNo]);
	if (!fn) {
		vscode.window.showWarningMessage('Put your cursor on a function line.');
		return;
	}
	if (support.hasComment(lines, lineNo)) {
		vscode.window.showInformationMessage('This function already has a comment.');
		return;
	}
	const indent = lines[lineNo].match(/^\s*/)![0];
	editor.edit(edit =>
		edit.insert(
			new vscode.Position(support.insertLine(lines, lineNo), 0),
			support.build(indent, fn, buildOptions(doc))
		)
	);
}

// ---------- Activation ----------

export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('docster');
	const timers = new Map<string, NodeJS.Timeout>();

	// Re-scans a document 300 ms after the last keystroke instead of on every edit
	const schedule = (doc: vscode.TextDocument) => {
		if (!isAnalyzable(doc)) {
			return;
		}
		const key = doc.uri.toString();
		clearTimeout(timers.get(key));
		timers.set(key, setTimeout(() => {
			timers.delete(key);
			updateDiagnostics(doc, collection);
		}, DEBOUNCE_MS));
	};

	context.subscriptions.push(
		collection,
		{ dispose: () => timers.forEach(t => clearTimeout(t)) },
		vscode.commands.registerCommand('docster.addComment', addComment),
		vscode.commands.registerCommand('docster.generateDocs', generateDocs),
		vscode.commands.registerCommand('docster.generateProjectDocs', generateProjectDocs),
		vscode.languages.registerCodeActionsProvider(LANGUAGE_IDS, new DocFixProvider(), {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		}),
		vscode.workspace.onDidOpenTextDocument(d => updateDiagnostics(d, collection)),
		vscode.workspace.onDidChangeTextDocument(e => schedule(e.document)),
		vscode.workspace.onDidCloseTextDocument(d => {
			clearTimeout(timers.get(d.uri.toString()));
			timers.delete(d.uri.toString());
			collection.delete(d.uri);
		}),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('docster')) {
				vscode.workspace.textDocuments.forEach(d => updateDiagnostics(d, collection));
			}
		})
	);

	vscode.workspace.textDocuments.forEach(d => updateDiagnostics(d, collection));
}

export function deactivate() { }
