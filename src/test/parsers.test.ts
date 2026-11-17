import * as assert from 'assert';
import { buildFileDocs } from '../core/docs';
import { BuildOptions } from '../core/types';
import { getSupport, languageIdForPath } from '../languages';

// Pure tests: no vscode import, so they also run with plain mocha in milliseconds.

function parse(lang: string, line: string) {
	return getSupport(lang)!.parse(line);
}

function check(lang: string, cases: Array<[string, string | undefined, string[]?]>) {
	for (const [line, name, params] of cases) {
		const fn = parse(lang, line);
		if (name === undefined) {
			assert.strictEqual(fn, undefined, `should NOT parse: ${line}`);
		} else {
			assert.deepStrictEqual(fn, { name, params: params ?? [] }, `line: ${line}`);
		}
	}
}

suite('parse: JavaScript / TypeScript', () => {
	test('functions and arrows', () => check('typescript', [
		['function foo(a, b) {', 'foo', ['a', 'b']],
		['export async function load(id: string, n = 3) {', 'load', ['id', 'n']],
		['function* gen(x) {', 'gen', ['x']],
		['const add = (a: number, b: number) => a + b;', 'add', ['a', 'b']],
		['const run = async (cmd) => {', 'run', ['cmd']],
	]));
	test('generics', () => check('typescript', [
		['function foo<T>(a: T) {', 'foo', ['a']],
		['function pick<T extends Record<string, K>, K>(o: T, k: K) {', 'pick', ['o', 'k']],
		['const id = <T,>(x: T) => x;', 'id', ['x']],
	]));
	test('return types and callback params', () => check('typescript', [
		['const f = (a: number): number => a;', 'f', ['a']],
		['function on(cb: (x: number) => void, tag: string) {', 'on', ['cb', 'tag']],
	]));
	test('destructured, rest and optional params', () => check('typescript', [
		['function f({ a, b }, [c]) {', 'f', ['param1', 'param2']],
		['function f(...args: any[]) {', 'f', ['args']],
		['function f(a?: string) {', 'f', ['a']],
		['function f(this: Foo, a: number) {', 'f', ['a']],
	]));
	test('ignores non-functions', () => check('typescript', [
		['// function foo(a) {', undefined],
		[' * function foo(a)', undefined],
		['const x = (1 + 2) * 3;', undefined],
		['const y = (a);', undefined],
		['functionality(a)', undefined],
	]));
});

suite('parse: other languages', () => {
	test('java', () => check('java', [
		['public static int add(int a, int b) {', 'add', ['a', 'b']],
		['    Map<String, List<Integer>> build(Map<K, V> m, int n) throws IOException {', 'build', ['m', 'n']],
		['if (x) {', undefined],
		['return foo(a);', undefined],
	]));
	test('c / c++', () => check('c', [
		['int add(int a, int b) {', 'add', ['a', 'b']],
		['void run(void) {', 'run', []],
		['static char *dup(const char *s) {', 'dup', ['s']],
		['while (x) {', undefined],
	]));
	test('php', () => check('php', [
		['public function foo($a, $b = 1) {', 'foo', ['$a', '$b']],
	]));
	test('csharp', () => check('csharp', [
		['public async Task<int> Foo(int a, string b)', 'Foo', ['a', 'b']],
		['foreach (var x in xs)', undefined],
	]));
	test('go', () => check('go', [
		['func (s *Server) Do(a int, b string) error {', 'Do', ['a', 'b']],
		['func main() {', 'main', []],
	]));
	test('dart', () => check('dart', [
		['Future<void> load(String id, {int retries = 3}) async {', 'load', ['id', 'retries']],
		['int twice(int x) => x * 2;', 'twice', ['x']],
	]));
	test('python', () => check('python', [
		['def f(self, a: int = 1, *args, **kw):', 'f', ['a', 'args', 'kw']],
		['    async def g(cls, x):', 'g', ['x']],
		['def h(d: Dict[str, int], n):', 'h', ['d', 'n']],
	]));
});

suite('build / hasComment / description', () => {
	const ts = getSupport('typescript')!;
	const fn = { name: 'foo', params: ['a', 'b'] };

	test('block comment is detected and read back', () => {
		const lines = ts.build('', fn).split('\n').slice(0, -1).concat('function foo(a, b) {');
		assert.ok(ts.hasComment(lines, lines.length - 1));
		assert.strictEqual(ts.description(lines, lines.length - 1), '');
		lines[1] = ' * Adds things';
		assert.strictEqual(ts.description(lines, lines.length - 1), 'Adds things');
	});

	test('decorators are skipped when inserting', () => {
		const lines = ['@Component()', '@Foo', 'function f(a) {'];
		assert.strictEqual(ts.insertLine(lines, 2), 0);
	});

	test('python: indent unit and style', () => {
		const py = getSupport('python')!;
		const opts: BuildOptions = { indentUnit: '\t', pythonStyle: 'google' };
		const out = py.build('', { name: 'f', params: ['a'] }, opts);
		assert.ok(out.startsWith('\t"""Description of f'));
		assert.ok(out.includes('\t\ta:'));
		const np = py.build('', { name: 'f', params: ['a'] }, { indentUnit: '  ', pythonStyle: 'numpy' });
		assert.ok(np.includes('  Parameters\n  ----------\n  a :'));
		assert.strictEqual(py.insertLine(['def f(a):'], 0), 1);
	});

	test('python docstring is detected', () => {
		const py = getSupport('python')!;
		const lines = ['def f(a):', '    """Does a thing.', '', '    Args:', '        a:', '    """'];
		assert.ok(py.hasComment(lines, 0));
		assert.strictEqual(py.description(lines, 0), 'Does a thing.');
	});

	test('go comment goes directly above', () => {
		const go = getSupport('go')!;
		assert.strictEqual(go.insertLine(['func Do() {'], 0), 0);
		assert.ok(!go.hasComment(['func Do() {'], 0));
	});
});

suite('docs + helpers', () => {
	test('buildFileDocs lists functions with descriptions', () => {
		const lines = ['/**', ' * Adds numbers', ' */', 'function add(a, b) {', '}', 'function sub(a) {', '}'];
		const { md, count } = buildFileDocs(lines, getSupport('javascript')!, 'x.js', 2);
		assert.strictEqual(count, 2);
		assert.ok(md.includes('### add(a, b)\n\nAdds numbers'));
		assert.ok(md.includes('### sub(a)\n\n_No description yet._'));
	});

	test('languageIdForPath', () => {
		assert.strictEqual(languageIdForPath('src/a/b.tsx'), 'typescriptreact');
		assert.strictEqual(languageIdForPath('main.GO'), 'go');
		assert.strictEqual(languageIdForPath('notes.md'), undefined);
	});
});
