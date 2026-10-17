import * as vscode from 'vscode';

interface ParsedFunction {
	name: string;
	params: string[];
}

interface LangSupport {
	ids: string[];
	parse(text: string): ParsedFunction | undefined;
	hasComment(doc: vscode.TextDocument, line: number): boolean;
	build(indent: string, fn: ParsedFunction): string;
	insertPosition(doc: vscode.TextDocument, line: number): vscode.Position;
	description(doc: vscode.TextDocument, line: number): string;
}

const PLACEHOLDER = 'Description of ';

// Moves up past lines like @override or @staticmethod
/**
 * Description of firstLineAboveDecorators
 *
 * @param doc
 * @param line
 * @returns
 */
function firstLineAboveDecorators(doc: vscode.TextDocument, line: number): number {
	let l = line;
	while (l > 0 && doc.lineAt(l - 1).text.trim().startsWith('@')) {
		l--;
	}
	return l;
}

// ---------- JavaScript / TypeScript ----------

const JS_PATTERNS = [
	/function\s+(\w+)\s*\(([^)]*)\)/,
	/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
];

const jsSupport: LangSupport = {
	ids: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],

	parse(text) {
		for (const pattern of JS_PATTERNS) {
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
	},

	hasComment(doc, line) {
		return line > 0 && doc.lineAt(line - 1).text.trim().endsWith('*/');
	},

	build(indent, fn) {
		return (
			`${indent}/**\n` +
			`${indent} * ${PLACEHOLDER}${fn.name}\n` +
			`${indent} *\n` +
			fn.params.map(p => `${indent} * @param ${p}\n`).join('') +
			`${indent} * @returns\n` +
			`${indent} */\n`
		);
	},

	insertPosition(_doc, line) {
		return new vscode.Position(line, 0);
	},

	description(doc, line) {
		if (!this.hasComment(doc, line)) {
			return '';
		}
		const lines: string[] = [];
		for (let i = line - 1; i >= 0; i--) {
			const t = doc.lineAt(i).text.trim();
			if (t.startsWith('/**')) {
				break;
			}
			const clean = t.replace(/^\*+\/?\s?/, '').trim();
			if (clean && !clean.startsWith('@') && !clean.startsWith(PLACEHOLDER)) {
				lines.unshift(clean);
			}
		}
		return lines.join(' ');
	},
};

// ---------- Dart ----------

const DART_PATTERN =
	/^\s*(?:static\s+)?[\w<>?,.[\]]+\s+(\w+)\s*\(([^)]*)\)\s*(?:async\*?\s*|sync\*\s*)?(?:\{|=>)/;
const DART_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return'];

/**
 * Description of parseDartParams
 *
 * @param raw
 * @returns
 */
function parseDartParams(raw: string): string[] {
	return raw
		.replace(/[{}[\]]/g, '')
		.split(',')
		.map(p => p.split('=')[0].trim())
		.map(p => p.split(/\s+/).pop() ?? '')
		.map(p => p.replace(/^this\./, ''))
		.filter(Boolean);
}

const dartSupport: LangSupport = {
	ids: ['dart'],

	parse(text) {
		const m = text.match(DART_PATTERN);
		if (!m || DART_SKIP.includes(m[1])) {
			return undefined;
		}
		return { name: m[1], params: parseDartParams(m[2]) };
	},

	hasComment(doc, line) {
		const l = firstLineAboveDecorators(doc, line);
		return l > 0 && doc.lineAt(l - 1).text.trim().startsWith('///');
	},

	build(indent, fn) {
		let s = `${indent}/// ${PLACEHOLDER}${fn.name}\n`;
		if (fn.params.length) {
			s += `${indent}///\n`;
			s += fn.params.map(p => `${indent}/// - [${p}]:\n`).join('');
		}
		return s;
	},

	insertPosition(doc, line) {
		return new vscode.Position(firstLineAboveDecorators(doc, line), 0);
	},

	description(doc, line) {
		const lines: string[] = [];
		let i = firstLineAboveDecorators(doc, line) - 1;
		while (i >= 0 && doc.lineAt(i).text.trim().startsWith('///')) {
			const clean = doc.lineAt(i).text.trim().replace(/^\/\/\/\s?/, '').trim();
			if (clean && !clean.startsWith('- [') && !clean.startsWith(PLACEHOLDER)) {
				lines.unshift(clean);
			}
			i--;
		}
		return lines.join(' ');
	},
};

// ---------- Python ----------

const PY_PATTERN = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/;

const pySupport: LangSupport = {
	ids: ['python'],

	parse(text) {
		const m = text.match(PY_PATTERN);
		if (!m) {
			return undefined;
		}
		const params = m[2]
			.split(',')
			.map(p => p.split(/[:=]/)[0].trim().replace(/^\*+/, ''))
			.filter(p => p && p !== 'self' && p !== 'cls' && p !== '/');
		return { name: m[1], params };
	},

	// Python docstrings go INSIDE the function, right after the def line
	hasComment(doc, line) {
		if (line + 1 >= doc.lineCount) {
			return false;
		}
		const next = doc.lineAt(line + 1).text.trim();
		return /^[rRuU]?("""|''')/.test(next);
	},

	build(indent, fn) {
		const inner = indent + '    ';
		let s = `${inner}"""${PLACEHOLDER}${fn.name}\n`;
		if (fn.params.length) {
			s += `\n${inner}Args:\n`;
			s += fn.params.map(p => `${inner}    ${p}:\n`).join('');
		}
		s += `\n${inner}Returns:\n${inner}"""\n`;
		return s;
	},

	insertPosition(_doc, line) {
		return new vscode.Position(line + 1, 0);
	},

	description(doc, line) {
		const out: string[] = [];
		for (let i = line + 1; i < doc.lineCount; i++) {
			let t = doc.lineAt(i).text.trim();
			if (i === line + 1) {
				t = t.replace(/^[rRuU]?("""|''')/, '');
			}
			const closes = /("""|''')$/.test(t);
			t = t.replace(/("""|''')$/, '').trim();
			if (/^(Args|Arguments|Parameters|Returns|Raises):?$/.test(t)) {
				break;
			}
			if (!t) {
				if (out.length || closes) {
					break;
				}
				continue;
			}
			if (!t.startsWith(PLACEHOLDER)) {
				out.push(t);
			}
			if (closes) {
				break;
			}
		}
		return out.join(' ');
	},
};

// ---------- Shared logic ----------

const SUPPORTS: LangSupport[] = [jsSupport, dartSupport, pySupport];
const LANGUAGE_IDS = SUPPORTS.flatMap(s => s.ids);

/**
 * Description of getSupport
 *
 * @param doc
 * @returns
 */
function getSupport(doc: vscode.TextDocument): LangSupport | undefined {
	return SUPPORTS.find(s => s.ids.includes(doc.languageId));
}

function updateDiagnostics(
	doc: vscode.TextDocument,
	collection: vscode.DiagnosticCollection
) {
	const support = getSupport(doc);
	if (!support) {
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
		const support = getSupport(doc);
		if (!support) {
			return [];
		}
		const actions: vscode.CodeAction[] = [];
		for (const d of context.diagnostics) {
			if (d.source !== 'auto-doc') {
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
				support.insertPosition(doc, lineNo),
				support.build(indent, fn)
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

// Saves DOCS.md in the folder, or shows a temporary page if no folder is open
/**
 * Description of outputDocs
 *
 * @param md
 * @param folder
 * @returns
 */
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

/**
 * Description of generateDocs
 *
 * @returns
 */
async function generateDocs() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const doc = editor.document;
	const support = getSupport(doc);
	if (!support) {
		vscode.window.showWarningMessage(
			'This language is not supported yet (JavaScript, TypeScript, Dart, Python).'
		);
		return;
	}

	const fileName = doc.uri.path.split('/').pop() ?? 'file';
	const { md, count } = buildFileDocs(doc, support, fileName, 1);

	if (count === 0) {
		vscode.window.showWarningMessage('No functions found in this file.');
		return;
	}

	const folder =
		vscode.workspace.getWorkspaceFolder(doc.uri) ??
		vscode.workspace.workspaceFolders?.[0];
	await outputDocs(md, folder);
}

/**
 * Description of generateProjectDocs
 *
 * @returns
 */
async function generateProjectDocs() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('Open a folder first (File > Open Folder).');
		return;
	}

	const files = await vscode.workspace.findFiles(
		'**/*.{js,jsx,ts,tsx,dart,py}',
		'**/{node_modules,out,dist,build,.git,.dart_tool,venv,.venv,__pycache__}/**',
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
				const support = getSupport(doc);
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

/**
 * Description of activate
 *
 * @param context
 * @returns
 */
export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('auto-doc');

	const addComment = vscode.commands.registerCommand('autoDoc.addComment', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const doc = editor.document;
		const support = getSupport(doc);
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
			edit.insert(support.insertPosition(doc, lineNo), support.build(indent, fn))
		);
	});

	context.subscriptions.push(
		collection,
		addComment,
		vscode.commands.registerCommand('autoDoc.generateDocs', generateDocs),
		vscode.commands.registerCommand('autoDoc.generateProjectDocs', generateProjectDocs),
		vscode.languages.registerCodeActionsProvider(LANGUAGE_IDS, new DocFixProvider(), {
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

/**
 * Description of deactivate
 *
 * @returns
 */
export function deactivate() { }