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

// ---------- Helpers ----------

// Moves up past lines like @Override, @staticmethod or [Attribute]
function firstLineAboveDecorators(
	doc: vscode.TextDocument,
	line: number,
	markers: string[] = ['@']
): number {
	let l = line;
	while (l > 0) {
		const t = doc.lineAt(l - 1).text.trim();
		if (!markers.some(m => t.startsWith(m))) {
			break;
		}
		l--;
	}
	return l;
}

// Splits "a, Map<K, V> b, c" on top-level commas only
function splitParams(raw: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for (const ch of raw) {
		if ('<([{'.includes(ch)) {
			depth++;
		} else if ('>)]}'.includes(ch)) {
			depth = Math.max(0, depth - 1);
		}
		if (ch === ',' && depth === 0) {
			out.push(cur);
			cur = '';
		} else {
			cur += ch;
		}
	}
	out.push(cur);
	return out.map(s => s.trim()).filter(Boolean);
}

// Last word of "const char *name = x" -> "name"
function lastWord(p: string): string {
	const cleaned = p.split('=')[0].replace(/\[.*?\]/g, '').trim();
	return cleaned.match(/(\w+)\s*$/)?.[1] ?? '';
}

// Last line of a signature whose "(" ... ")" may be split over several lines.
// If the brackets never balance within `max` lines, only the first line is used.
function signatureEnd(doc: vscode.TextDocument, line: number, max = 12): number {
	let open = 0;
	for (let i = line; i < doc.lineCount && i < line + max; i++) {
		for (const ch of doc.lineAt(i).text) {
			if (ch === '(') {
				open++;
			} else if (ch === ')') {
				open--;
			}
		}
		if (open <= 0) {
			return i;
		}
	}
	return line;
}

// The whole signature joined into one line, so the one-line patterns still work
function signatureText(doc: vscode.TextDocument, line: number): string {
	const end = signatureEnd(doc, line);
	const parts = [doc.lineAt(line).text];
	for (let i = line + 1; i <= end; i++) {
		parts.push(doc.lineAt(i).text.trim());
	}
	return parts.join(' ');
}

function parseWith(
	text: string,
	pattern: RegExp,
	skip: string[],
	toParams: (raw: string) => string[]
): ParsedFunction | undefined {
	const m = text.match(pattern);
	if (!m || skip.includes(m[1])) {
		return undefined;
	}
	return { name: m[1], params: toParams(m[2]) };
}

// Used by JavaScript, Java, C and PHP: comments written as /** ... */
function makeBlockSupport(opts: {
	ids: string[];
	parse: (text: string) => ParsedFunction | undefined;
	returnTag: string;
	paramType?: string;
	markers?: string[];
}): LangSupport {
	const markers = opts.markers ?? [];

	const hasComment = (doc: vscode.TextDocument, line: number): boolean => {
		const l = firstLineAboveDecorators(doc, line, markers);
		return l > 0 && doc.lineAt(l - 1).text.trim().endsWith('*/');
	};

	return {
		ids: opts.ids,
		parse: opts.parse,
		hasComment,

		build(indent, fn) {
			const type = opts.paramType ? opts.paramType + ' ' : '';
			return (
				`${indent}/**\n` +
				`${indent} * ${PLACEHOLDER}${fn.name}\n` +
				`${indent} *\n` +
				fn.params.map(p => `${indent} * @param ${type}${p}\n`).join('') +
				`${indent} * ${opts.returnTag}\n` +
				`${indent} */\n`
			);
		},

		insertPosition(doc, line) {
			return new vscode.Position(firstLineAboveDecorators(doc, line, markers), 0);
		},

		description(doc, line) {
			if (!hasComment(doc, line)) {
				return '';
			}
			const lines: string[] = [];
			for (let i = firstLineAboveDecorators(doc, line, markers) - 1; i >= 0; i--) {
				const t = doc.lineAt(i).text.trim();
				if (t.startsWith('/**')) {
					// also handles one-line comments like /** Adds numbers */
					const inline = t.replace(/^\/\*+\s?/, '').replace(/\*+\/$/, '').trim();
					if (inline && !inline.startsWith('@') && !inline.startsWith(PLACEHOLDER)) {
						lines.unshift(inline);
					}
					break;
				}
				if (t.startsWith('/*')) {
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
}

// ---------- JavaScript / TypeScript ----------

const JS_PATTERNS = [
	// function foo(a, b)   and   function foo<T>(a: T)
	/function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/,
	// const foo = (a, b) =>   also with generics and a return type: (a): number =>
	/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:<[^>]*>\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>/,
	// class method:   async save(a, b): Promise<void> {
	// Quotes and brackets are not allowed inside the parameters, so calls such as
	// it('does x', function () { are not mistaken for methods.
	/^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^()'"`]*)\)\s*(?::\s*[^{]+)?\{\s*$/,
];
// Names that look like methods but are really statements
const JS_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with'];

const jsSupport = makeBlockSupport({
	ids: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
	parse: text => {
		// Ignore commented-out code and comment text
		const t = text.trim();
		if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
			return undefined;
		}
		for (const pattern of JS_PATTERNS) {
			const m = text.match(pattern);
			if (m && !JS_SKIP.includes(m[1])) {
				const params = splitParams(m[2])
					.map(p => p.split(/[:=]/)[0].trim())
					// constructor(private x: number) -> x
					.map(p => p.replace(/^(?:(?:public|private|protected|readonly)\s+)+/, ''))
					.filter(Boolean)
					.map((p, i) => (p.startsWith('{') || p.startsWith('[') ? `param${i + 1}` : p));
				return { name: m[1], params };
			}
		}
		return undefined;
	},
	returnTag: '@returns',
	markers: ['@'],
});

// ---------- Java ----------

const JAVA_PATTERN =
	/^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*(?:<[^()]*>\s+)?[\w.]+(?:<[^()]*>)?(?:\[\])*\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$/;
const JAVA_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'new', 'synchronized', 'throw'];

const javaSupport = makeBlockSupport({
	ids: ['java'],
	parse: text =>
		parseWith(text, JAVA_PATTERN, JAVA_SKIP, raw => splitParams(raw).map(lastWord).filter(Boolean)),
	returnTag: '@return',
	markers: ['@'],
});

// ---------- C / C++ ----------

const C_PATTERN =
	/^\s*(?:(?:static|inline|extern|const|unsigned|signed|struct|enum|virtual|constexpr)\s+)*[\w:<>*&]+[\s*&]+(?:\w+::)*(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?(?:noexcept\s*)?\{?\s*$/;
const C_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'sizeof', 'defined'];

function parseCParams(raw: string): string[] {
	if (raw.trim() === '' || raw.trim() === 'void') {
		return [];
	}
	return splitParams(raw).map(lastWord).filter(p => p && p !== 'void');
}

const cSupport = makeBlockSupport({
	ids: ['c', 'cpp'],
	parse: text => parseWith(text, C_PATTERN, C_SKIP, parseCParams),
	returnTag: '@return',
});

// ---------- PHP ----------

const PHP_PATTERN =
	/^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+&?(\w+)\s*\(([^)]*)\)/;

const phpSupport = makeBlockSupport({
	ids: ['php'],
	parse: text =>
		parseWith(text, PHP_PATTERN, [], raw =>
			splitParams(raw)
				.map(p => p.match(/\$\w+/)?.[0] ?? '')
				.filter(Boolean)
		),
	returnTag: '@return',
	paramType: 'mixed',
	markers: ['#['],
});

// ---------- C# (XML comments) ----------

const CS_PATTERN =
	/^\s*(?:\[[^\]]*\]\s*)*(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|sealed|extern|unsafe|partial|new|readonly)\s+)*[\w.]+(?:<[^()]*>)?(?:\[\])*\??\s+(\w+)\s*(?:<[^()]*>)?\s*\(([^)]*)\)\s*(?:where\s[^{=]*)?(?:\{|=>.*)?\s*$/;
const CS_SKIP = [
	'if', 'for', 'foreach', 'while', 'switch', 'catch', 'else', 'return',
	'new', 'using', 'lock', 'await', 'throw', 'nameof', 'typeof',
];
const CS_MARKERS = ['['];

const csSupport: LangSupport = {
	ids: ['csharp'],

	parse(text) {
		return parseWith(text, CS_PATTERN, CS_SKIP, raw => splitParams(raw).map(lastWord).filter(Boolean));
	},

	hasComment(doc, line) {
		const l = firstLineAboveDecorators(doc, line, CS_MARKERS);
		return l > 0 && doc.lineAt(l - 1).text.trim().startsWith('///');
	},

	build(indent, fn) {
		return (
			`${indent}/// <summary>\n` +
			`${indent}/// ${PLACEHOLDER}${fn.name}\n` +
			`${indent}/// </summary>\n` +
			fn.params.map(p => `${indent}/// <param name="${p}"></param>\n`).join('') +
			`${indent}/// <returns></returns>\n`
		);
	},

	insertPosition(doc, line) {
		return new vscode.Position(firstLineAboveDecorators(doc, line, CS_MARKERS), 0);
	},

	description(doc, line) {
		const lines: string[] = [];
		let i = firstLineAboveDecorators(doc, line, CS_MARKERS) - 1;
		while (i >= 0 && doc.lineAt(i).text.trim().startsWith('///')) {
			const raw = doc.lineAt(i).text.trim().replace(/^\/\/\/\s?/, '').trim();
			if (!/^<(param|returns|typeparam|exception)/.test(raw)) {
				const clean = raw.replace(/<[^>]+>/g, '').trim();
				if (clean && !clean.startsWith(PLACEHOLDER)) {
					lines.unshift(clean);
				}
			}
			i--;
		}
		return lines.join(' ');
	},
};

// ---------- Go ----------

const GO_PATTERN = /^func\s+(?:\([^)]*\)\s*)?(\w+)\s*(?:\[[^\]]*\])?\s*\(([^)]*)\)/;

const goSupport: LangSupport = {
	ids: ['go'],

	parse(text) {
		return parseWith(text, GO_PATTERN, [], raw =>
			splitParams(raw)
				.map(p => p.split(/\s+/)[0].replace(/[^\w]/g, ''))
				.filter(Boolean)
		);
	},

	hasComment(doc, line) {
		return line > 0 && doc.lineAt(line - 1).text.trim().startsWith('//');
	},

	// Go style: the comment starts with the function name
	build(indent, fn) {
		return `${indent}// ${fn.name} TODO: describe what ${fn.name} does.\n`;
	},

	insertPosition(_doc, line) {
		return new vscode.Position(line, 0);
	},

	description(doc, line) {
		const lines: string[] = [];
		let i = line - 1;
		while (i >= 0 && doc.lineAt(i).text.trim().startsWith('//')) {
			const clean = doc.lineAt(i).text.trim().replace(/^\/\/+\s?/, '').trim();
			if (clean && !clean.includes('TODO: describe')) {
				lines.unshift(clean);
			}
			i--;
		}
		return lines.join(' ');
	},
};

// ---------- Dart (Flutter) ----------

const DART_PATTERN =
	/^\s*(?:static\s+)?[\w<>?,.[\]]+\s+(\w+)\s*\(([^)]*)\)\s*(?:async\*?\s*|sync\*\s*)?(?:\{|=>)/;
const DART_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return'];

function parseDartParams(raw: string): string[] {
	return splitParams(raw.replace(/[{}[\]]/g, ''))
		.map(p => p.split('=')[0].trim())
		.map(p => p.split(/\s+/).pop() ?? '')
		.map(p => p.replace(/^this\./, ''))
		.filter(Boolean);
}

const dartSupport: LangSupport = {
	ids: ['dart'],

	parse(text) {
		return parseWith(text, DART_PATTERN, DART_SKIP, parseDartParams);
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
		const params = splitParams(m[2])
			.map(p => p.split(/[:=]/)[0].trim().replace(/^\*+/, ''))
			.filter(p => p && p !== 'self' && p !== 'cls' && p !== '/');
		return { name: m[1], params };
	},

	// Python docstrings go INSIDE the function, right after the def line
	// (after the closing "):" when the signature is split over several lines)
	hasComment(doc, line) {
		const end = signatureEnd(doc, line);
		if (end + 1 >= doc.lineCount) {
			return false;
		}
		const next = doc.lineAt(end + 1).text.trim();
		return /^[rRuU]?("""|''')/.test(next);
	},

	// Style comes from the "docster.pythonDocstringStyle" setting (google or numpy)
	build(indent, fn) {
		const inner = indent + '    ';
		const style = vscode.workspace
			.getConfiguration('docster')
			.get<string>('pythonDocstringStyle', 'google');
		let s = `${inner}"""${PLACEHOLDER}${fn.name}\n`;
		if (style === 'numpy') {
			if (fn.params.length) {
				s += `\n${inner}Parameters\n${inner}----------\n`;
				s += fn.params.map(p => `${inner}${p} :\n`).join('');
			}
			return s + `\n${inner}Returns\n${inner}-------\n${inner}"""\n`;
		}
		if (fn.params.length) {
			s += `\n${inner}Args:\n`;
			s += fn.params.map(p => `${inner}    ${p}:\n`).join('');
		}
		return s + `\n${inner}Returns:\n${inner}"""\n`;
	},

	insertPosition(doc, line) {
		return new vscode.Position(signatureEnd(doc, line) + 1, 0);
	},

	description(doc, line) {
		const start = signatureEnd(doc, line) + 1;
		const out: string[] = [];
		for (let i = start; i < doc.lineCount; i++) {
			let t = doc.lineAt(i).text.trim();
			if (i === start) {
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

const SUPPORTS: LangSupport[] = [
	jsSupport,
	dartSupport,
	pySupport,
	javaSupport,
	cSupport,
	csSupport,
	goSupport,
	phpSupport,
];
const LANGUAGE_IDS = SUPPORTS.flatMap(s => s.ids);

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
		if (support.parse(signatureText(doc, i)) && !support.hasComment(doc, i)) {
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

// Typing triggers a rescan of the whole file, so wait until the user pauses
const diagnosticTimers = new Map<string, NodeJS.Timeout>();

function scheduleDiagnostics(
	doc: vscode.TextDocument,
	collection: vscode.DiagnosticCollection
) {
	if (!getSupport(doc)) {
		return;
	}
	const key = doc.uri.toString();
	const existing = diagnosticTimers.get(key);
	if (existing) {
		clearTimeout(existing);
	}
	diagnosticTimers.set(
		key,
		setTimeout(() => {
			diagnosticTimers.delete(key);
			updateDiagnostics(doc, collection);
		}, 300)
	);
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
			if (d.source !== 'docster') {
				continue;
			}
			const lineNo = d.range.start.line;
			const text = doc.lineAt(lineNo).text;
			const fn = support.parse(signatureText(doc, lineNo));
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
		const fn = support.parse(signatureText(doc, i));
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
	const support = getSupport(doc);
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

export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('docster');

	const addComment = vscode.commands.registerCommand('docster.addComment', () => {
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
		const fn = support.parse(signatureText(doc, lineNo));
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
		vscode.commands.registerCommand('docster.generateDocs', generateDocs),
		vscode.commands.registerCommand('docster.generateProjectDocs', generateProjectDocs),
		vscode.languages.registerCodeActionsProvider(LANGUAGE_IDS, new DocFixProvider(), {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		}),
		vscode.workspace.onDidOpenTextDocument(d => updateDiagnostics(d, collection)),
		vscode.workspace.onDidChangeTextDocument(e =>
			scheduleDiagnostics(e.document, collection)
		),
		vscode.workspace.onDidCloseTextDocument(d => {
			const key = d.uri.toString();
			const timer = diagnosticTimers.get(key);
			if (timer) {
				clearTimeout(timer);
				diagnosticTimers.delete(key);
			}
			collection.delete(d.uri);
		}),
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