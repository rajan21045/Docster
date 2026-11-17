import { ParsedFunction } from './types';

// Moves up past lines like @Override, @staticmethod or [Attribute]
export function firstLineAboveDecorators(lines: string[], line: number, markers: string[] = ['@']): number {
	let l = line;
	while (l > 0) {
		const t = lines[l - 1].trim();
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

// Index of the ")" that closes the "(" at `open`, or -1 if it is not on this line
export function findClosingParen(text: string, open: number): number {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === '(') {
			depth++;
		} else if (text[i] === ')') {
			depth--;
			if (depth === 0) {
				return i;
			}
		}
	}
	return -1;
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
