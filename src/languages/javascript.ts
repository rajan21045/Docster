import { makeBlockSupport, splitParams } from '../core/helpers';

const JS_PATTERNS = [
	/function\s+(\w+)\s*\(([^)]*)\)/,
	/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
];

export const jsSupport = makeBlockSupport({
	ids: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
	parse: text => {
		// Ignore commented-out code and comment text
		const t = text.trim();
		if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
			return undefined;
		}
		for (const pattern of JS_PATTERNS) {
			const m = text.match(pattern);
			if (m) {
				const params = splitParams(m[2])
					.map(p => p.split(/[:=]/)[0].trim())
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