import * as vscode from 'vscode';
import { LangSupport } from './core/types';
import { getSupport, LANGUAGE_IDS } from './languages';

// Reads the "docster.pythonDocstringStyle" setting (google or numpy)
function pythonStyle(): 'google' | 'numpy' {
	return vscode.workspace
		.getConfiguration('docster')
		.get<'google' | 'numpy'>('pythonDocstringStyle', 'google');
}

function updateDiagnostics(
	doc: vscode.TextDocument,
	collection: vscode.DiagnosticCollection
) {
	const support = getSupport(doc.languageId);
	if (!support) {
		return;
	}

	// Respect the "docster.warnMissingComments" setting
	const enabled = vscode.workspace
		.getConfiguration('docster')
		.get<boolean>('warnMissingComments', true);
	if (!enabled) {
		collection.delete(doc.uri);
		return;
	}

	const diagnostics: vscode.Diagnostic[] = [];
	for (let i = 0; i < doc.lineCount; i++) {
		const line = doc.lineAt(i);
		if (support.parse(line.text) && !support.hasComment(doc, i)) {
			const d = new vscode.Diagnostic(
				line.range,
				'Function has no doc comment',
				vscode.DiagnosticSeverity.Warning
			);
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
		const actions: vscode.CodeAction[] = [];
		for (const d of context.diagnostics) {
			if (d.source !== 'docster') {
				continue;
			}
			const lineNo = d.range.start.line;
			const text = doc.lineAt(lineNo).text;
			const fn = support.parse(text);
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
				new vscode.Position(support.insertLine(doc, lineNo), 0),
				support.build(indent, fn, { pythonStyle: pythonStyle() })
			);
			actions.push(action);
		}
		return actions;
	}
}

// Builds the Markdown for one file. level 1 = "# title", level 2 = "## title"
function buildFileDocs(
	doc: vscode.TextDocument,
	support: LangSupport,
	title: string,
	level: number
): { md: string; count: number } {
	const fileHeading = '#'.repeat(level);
	const fnHeading = '#'.repeat(level + 1);
	let md = `${fileHeading} ${title}\n\n`;
	let count = 0;

	for (let i = 0; i < doc.lineCount; i++) {
		const fn = support.parse(doc.lineAt(i).text);
		if (!fn) {
			continue;
		}
		count++;
		const description = support.description(doc, i) || '_No description yet._';
		md += `${fnHeading} ${fn.name}(${fn.params.join(', ')})\n\n${description}\n\n`;
		if (fn.params.length) {
			md += '**Parameters**\n\n';
			md += fn.params.map(p => `- \`${p}\``).join('\n') + '\n\n';
		}
	}
	return { md, count };
}

// Saves DOCS.md in the folder, or shows an unsaved page if no folder is given
async function outputDocs(md: string, folder: vscode.WorkspaceFolder | undefined) {
	if (!folder) {
		const out = await vscode.workspace.openTextDocument({
			content: md,
			language: 'markdown',
		});
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
		vscode.window.showWarningMessage(
			`This language is not supported yet. Supported: ${LANGUAGE_IDS.join(', ')}`
		);
		return;
	}

	const fileName = doc.uri.path.split('/').pop() ?? 'file';
	const { md, count } = buildFileDocs(doc, support, fileName, 1);

	if (count === 0) {
		vscode.window.showWarningMessage('No functions found in this file.');
		return;
	}

	await outputDocs(md, undefined);
}

// Project docs are saved to DOCS.md in the first workspace folder
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

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'Generating project documentation...',
		},
		async () => {
			for (const uri of files) {
				const rel = vscode.workspace.asRelativePath(uri, false);
				if (rel.endsWith('.d.ts')) {
					continue;
				}
				const doc = await vscode.workspace.openTextDocument(uri);
				const support = getSupport(doc.languageId);
				if (!support) {
					continue;
				}
				const result = buildFileDocs(doc, support, rel, 2);
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

	const header =
		`# Project Documentation\n\n` +
		`${totalFunctions} functions in ${totalFiles} files.\n\n`;
	await outputDocs(header + body, folder);
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Docster activated');
	const collection = vscode.languages.createDiagnosticCollection('docster');

	const addComment = vscode.commands.registerCommand('docster.addComment', () => {
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
		const lineNo = editor.selection.active.line;
		const text = doc.lineAt(lineNo).text;
		const fn = support.parse(text);
		if (!fn) {
			vscode.window.showWarningMessage('Put your cursor on a function line.');
			return;
		}
		if (support.hasComment(doc, lineNo)) {
			vscode.window.showInformationMessage('This function already has a comment.');
			return;
		}
		const indent = text.match(/^\s*/)![0];
		editor.edit(edit =>
			edit.insert(
				new vscode.Position(support.insertLine(doc, lineNo), 0),
				support.build(indent, fn, { pythonStyle: pythonStyle() })
			)
		);
	});

	context.subscriptions.push(
		collection,
		addComment,
		vscode.commands.registerCommand('docster.generateDocs', generateDocs),
		vscode.commands.registerCommand('docster.generateProjectDocs', generateProjectDocs),
		vscode.languages.registerCodeActionsProvider(LANGUAGE_IDS, new DocFixProvider(), {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		}),
		vscode.workspace.onDidOpenTextDocument(d => updateDiagnostics(d, collection)),
		vscode.workspace.onDidChangeTextDocument(e =>
			updateDiagnostics(e.document, collection)
		),
		vscode.workspace.onDidCloseTextDocument(d => collection.delete(d.uri)),
		// Refresh warnings when a Docster setting changes
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('docster')) {
				vscode.workspace.textDocuments.forEach(d => updateDiagnostics(d, collection));
			}
		})
	);

	vscode.workspace.textDocuments.forEach(d => updateDiagnostics(d, collection));
}

export function deactivate() { }