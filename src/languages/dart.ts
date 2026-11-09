import { LangSupport } from '../core/types';
import { PLACEHOLDER, firstLineAboveDecorators, parseWith, splitParams } from '../core/helpers';

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

export const dartSupport: LangSupport = {
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

	insertLine(doc, line) {
		return firstLineAboveDecorators(doc, line);
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