import { LangSupport, ParsedFunction, PLACEHOLDER } from './types';
import { firstLineAboveDecorators } from './utils';

// Used by JavaScript, Java, C and PHP: comments written as /** ... */
export function makeBlockSupport(opts: {
	ids: string[];
	parse: (text: string) => ParsedFunction | undefined;
	returnTag: string;
	paramType?: string;
	markers?: string[];
}): LangSupport {
	const markers = opts.markers ?? [];

	const hasComment = (lines: string[], line: number): boolean => {
		const l = firstLineAboveDecorators(lines, line, markers);
		return l > 0 && lines[l - 1].trim().endsWith('*/');
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

		insertLine: (lines, line) => firstLineAboveDecorators(lines, line, markers),

		description(lines, line) {
			if (!hasComment(lines, line)) {
				return '';
			}
			const out: string[] = [];
			for (let i = firstLineAboveDecorators(lines, line, markers) - 1; i >= 0; i--) {
				const t = lines[i].trim();
				if (t.startsWith('/**')) {
					// also handles one-line comments like /** Adds numbers */
					const inline = t.replace(/^\/\*+\s?/, '').replace(/\*+\/$/, '').trim();
					if (inline && !inline.startsWith('@') && !inline.startsWith(PLACEHOLDER)) {
						out.unshift(inline);
					}
					break;
				}
				if (t.startsWith('/*')) {
					break;
				}
				const clean = t.replace(/^\*+\/?\s?/, '').trim();
				if (clean && !clean.startsWith('@') && !clean.startsWith(PLACEHOLDER)) {
					out.unshift(clean);
				}
			}
			return out.join(' ');
		},
	};
}
