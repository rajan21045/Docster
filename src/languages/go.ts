import { LangSupport } from '../core/types';
import { parseWith, splitParams } from '../core/helpers';

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

	hasComment(doc, line) {
		return line > 0 && doc.lineAt(line - 1).text.trim().startsWith('//');
	},

	// Go style: the comment starts with the function name
	build(indent, fn) {
		return `${indent}// ${fn.name} TODO: describe what ${fn.name} does.\n`;
	},

	insertLine(_doc, line) {
		return line;
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