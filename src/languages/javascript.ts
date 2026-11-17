import { makeBlockSupport } from '../core/block';
import { findClosingParen, splitParams } from '../core/utils';
import { ParsedFunction } from '../core/types';

const FUNCTION = /\bfunction\b\s*\*?\s*(\w+)\s*(?:<[^(]*>)?\s*\(/;
const ARROW = /\b(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:<[^(]*>\s*)?\(/;

export function parseJs(text: string): ParsedFunction | undefined {
	// Ignore commented-out code and comment text
	const t = text.trim();
	if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
		return undefined;
	}

	let m = text.match(FUNCTION);
	let isArrow = false;
	if (!m) {
		m = text.match(ARROW);
		isArrow = true;
	}
	if (!m || m.index === undefined) {
		return undefined;
	}

	const open = m.index + m[0].length - 1;
	const close = findClosingParen(text, open);
	if (close < 0) {
		return undefined;
	}
	// an arrow needs "=>" after the parameters, optionally with a return type: (a): number =>
	if (isArrow && !/^\s*(?::[^=]+)?=>/.test(text.slice(close + 1))) {
		return undefined;
	}

	const params = splitParams(text.slice(open + 1, close))
		.map(p => p.split(/[:=]/)[0].trim().replace(/^\.\.\./, '').replace(/\?$/, ''))
		.filter(p => p && p !== 'this')
		.map((p, i) => (p.startsWith('{') || p.startsWith('[') ? `param${i + 1}` : p));
	return { name: m[1], params };
}

export const jsSupport = makeBlockSupport({
	ids: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
	parse: parseJs,
	returnTag: '@returns',
	markers: ['@'],
});
