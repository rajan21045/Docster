import * as assert from 'assert';
import { fakeDoc } from './helpers';
import { splitParams, signatureAt } from '../core/helpers';
import { pySupport } from '../languages/python';
import { jsSupport } from '../languages/javascript';
import { javaSupport } from '../languages/java';

suite('splitParams', () => {
	test('ignores commas inside generics', () => {
		assert.deepStrictEqual(splitParams('Map<K, V> a, int b'), ['Map<K, V> a', 'int b']);
	});
});

suite('python', () => {
	test('parses def and skips self', () => {
		assert.deepStrictEqual(
			pySupport.parse('def add(self, a: int, b=2):'),
			{ name: 'add', params: ['a', 'b'] }
		);
	});
	test('detects docstring on next line', () => {
		const doc = fakeDoc('def f(x):\n    """Hi"""\n    return x');
		assert.strictEqual(pySupport.hasComment(doc, 0), true);
	});
	test('numpy style output', () => {
		const out = pySupport.build('', { name: 'f', params: ['x'] }, { pythonStyle: 'numpy' });
		assert.ok(out.includes('Parameters'));
	});
});

suite('javascript', () => {
	test('arrow function', () => {
		assert.deepStrictEqual(
			jsSupport.parse('const sum = async (a, b) => a + b'),
			{ name: 'sum', params: ['a', 'b'] }
		);
	});
	test('ignores commented-out code', () => {
		assert.strictEqual(jsSupport.parse('// function old(a) {}'), undefined);
	});
	test('destructured params get placeholder names', () => {
		assert.deepStrictEqual(
			jsSupport.parse('function f({ a, b }, c) {}')?.params,
			['param1', 'c']
		);
	});
});

suite('javascript class methods and typed arrows', () => {
	test('typed arrow function', () => {
		assert.deepStrictEqual(
			jsSupport.parse('const add = (a: number, b: number): number => a + b'),
			{ name: 'add', params: ['a', 'b'] }
		);
	});
	test('class method with return type', () => {
		assert.deepStrictEqual(
			jsSupport.parse('    async save(a, b): Promise<void> {'),
			{ name: 'save', params: ['a', 'b'] }
		);
	});
	test('constructor parameter properties', () => {
		assert.deepStrictEqual(
			jsSupport.parse('  constructor(private x: number, public y: string) {')?.params,
			['x', 'y']
		);
	});
	test('if statement is not a method', () => {
		assert.strictEqual(jsSupport.parse('    if (x > 1) {'), undefined);
	});
	test('test-runner call is not a method', () => {
		assert.strictEqual(jsSupport.parse("  it('does x', function () {"), undefined);
	});
});

suite('java', () => {
	test('does not treat "if (x)" as a method', () => {
		assert.strictEqual(javaSupport.parse('    if (x > 1) {'), undefined);
	});
	test('parses generic method', () => {
		assert.strictEqual(
			javaSupport.parse('public static <T> List<T> of(T a, T b) {')?.name,
			'of'
		);
	});
	test('comment above @Override counts', () => {
		const doc = fakeDoc('/** hi */\n@Override\npublic void run() {');
		assert.strictEqual(javaSupport.hasComment(doc, 2), true);
	});
});

suite('multi-line signatures', () => {
	test('javascript', () => {
		const doc = fakeDoc('function f(a,\n  b) {\n}');
		assert.deepStrictEqual(
			jsSupport.parse(signatureAt(doc, 0)),
			{ name: 'f', params: ['a', 'b'] }
		);
	});
	test('python', () => {
		const doc = fakeDoc('def f(a,\n      b):\n    pass');
		assert.deepStrictEqual(
			pySupport.parse(signatureAt(doc, 0)),
			{ name: 'f', params: ['a', 'b'] }
		);
	});
	test('single line is unchanged', () => {
		assert.strictEqual(signatureAt(fakeDoc('def f(a):'), 0), 'def f(a):');
	});
	test('unbalanced brackets fall back to the first line', () => {
		assert.strictEqual(signatureAt(fakeDoc('foo(\nbar'), 0), 'foo(');
	});
});

suite('python multi-line', () => {
	test('docstring is found after the last parameter line', () => {
		const doc = fakeDoc('def f(a,\n      b):\n    """Hi"""\n    pass');
		assert.strictEqual(pySupport.hasComment(doc, 0), true);
	});
	test('docstring is inserted after the signature, not inside it', () => {
		const doc = fakeDoc('def f(a,\n      b):\n    pass');
		assert.strictEqual(pySupport.insertLine(doc, 0), 2);
	});
});