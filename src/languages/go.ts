import { LangSupport } from '../core/types';
import { parseWith, splitParams } from '../core/utils';

const GO_PATTERN = /^func\s+(?:\([^)]*\)\s*)?(\w+)\s*(?:\[[^\]]*\])?\s*\(([^)]*)\)/;

export const goSupport: LangSupport = {
	ids: ['go'],

	parse(text) {
		return parseWith(text, GO_PATTERN, [], raw =>
			splitParams(raw)
				.map(p => p.split(/\s+/)[0].replace(/[^\w]/g, ''))
				.filter(Boolean)
		);
	},

	hasComment: (lines, line) => line > 0 && lines[line - 1].trim().startsWith('//'),

	// Go style: the comment starts with the function name
	build: (indent, fn) => `${indent}// ${fn.name} TODO: describe what ${fn.name} does.\n`,

	insertLine: (_lines, line) => line,

	description(lines, line) {
		const out: string[] = [];
		let i = line - 1;
		while (i >= 0 && lines[i].trim().startsWith('//')) {
			const clean = lines[i].trim().replace(/^\/\/+\s?/, '').trim();
			if (clean && !clean.includes('TODO: describe')) {
				out.unshift(clean);
			}
			i--;
		}
		return out.join(' ');
	},
};
