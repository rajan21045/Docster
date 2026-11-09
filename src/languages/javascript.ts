import { makeBlockSupport, splitParams } from '../core/helpers';

const JS_PATTERNS = [
	// function foo(a, b)   and   function foo<T>(a: T)
	/function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/,
	// const foo = (a, b) =>   also with generics and a return type: (a): number =>
	/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:<[^>]*>\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>/,
	// class method:   async save(a, b): Promise<void> {
	// Quotes and brackets are not allowed inside the parameters, so calls such as
	// it('does x', function () { are not mistaken for methods.
	/^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^()'"`]*)\)\s*(?::\s*[^{]+)?\{\s*$/,
];
// Names that look like methods but are really statements
const JS_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with'];

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
			if (m && !JS_SKIP.includes(m[1])) {
				const params = splitParams(m[2])
					.map(p => p.split(/[:=]/)[0].trim())
					// constructor(private x: number) -> x
					.map(p => p.replace(/^(?:(?:public|private|protected|readonly)\s+)+/, ''))
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