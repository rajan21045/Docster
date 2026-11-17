import { LangSupport, PLACEHOLDER } from '../core/types';
import { firstLineAboveDecorators, lastWord, parseWith, splitParams } from '../core/utils';

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

	hasComment(lines, line) {
		const l = firstLineAboveDecorators(lines, line, CS_MARKERS);
		return l > 0 && lines[l - 1].trim().startsWith('///');
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

	insertLine: (lines, line) => firstLineAboveDecorators(lines, line, CS_MARKERS),

	description(lines, line) {
		const out: string[] = [];
		let i = firstLineAboveDecorators(lines, line, CS_MARKERS) - 1;
		while (i >= 0 && lines[i].trim().startsWith('///')) {
			const raw = lines[i].trim().replace(/^\/\/\/\s?/, '').trim();
			if (!/^<(param|returns|typeparam|exception)/.test(raw)) {
				const clean = raw.replace(/<[^>]+>/g, '').trim();
				if (clean && !clean.startsWith(PLACEHOLDER)) {
					out.unshift(clean);
				}
			}
			i--;
		}
		return out.join(' ');
	},
};
