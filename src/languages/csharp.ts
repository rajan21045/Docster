import { LangSupport } from '../core/types';
import { PLACEHOLDER, firstLineAboveDecorators, parseWith, splitParams, lastWord } from '../core/helpers';

const CS_PATTERN =
	/^\s*(?:\[[^\]]*\]\s*)*(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|sealed|extern|unsafe|partial|new|readonly)\s+)*[\w.]+(?:<[^()]*>)?(?:\[\])*\??\s+(\w+)\s*(?:<[^()]*>)?\s*\(([^)]*)\)\s*(?:where\s[^{=]*)?(?:\{|=>.*)?\s*$/;
const CS_SKIP = [
	'if', 'for', 'foreach', 'while', 'switch', 'catch', 'else', 'return',
	'new', 'using', 'lock', 'await', 'throw', 'nameof', 'typeof',
];
const CS_MARKERS = ['['];

export const csSupport: LangSupport = {
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

	insertLine(doc, line) {
		return firstLineAboveDecorators(doc, line, CS_MARKERS);
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