import { DocLike, ParsedFunction, LangSupport } from './types';

export const PLACEHOLDER = 'Description of ';

// Moves up past lines like @Override, @staticmethod or [Attribute]
export function firstLineAboveDecorators(
	doc: DocLike,
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
export function splitParams(raw: string): string[] {
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
export function lastWord(p: string): string {
	const cleaned = p.split('=')[0].replace(/\[.*?\]/g, '').trim();
	return cleaned.match(/(\w+)\s*$/)?.[1] ?? '';
}

export function parseWith(
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
export function makeBlockSupport(opts: {
	ids: string[];
	parse: (text: string) => ParsedFunction | undefined;
	returnTag: string;
	paramType?: string;
	markers?: string[];
}): LangSupport {
	const markers = opts.markers ?? [];

	const hasComment = (doc: DocLike, line: number): boolean => {
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

		insertLine(doc, line) {
			return firstLineAboveDecorators(doc, line, markers);
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