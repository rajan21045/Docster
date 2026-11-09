import * as assert from 'assert';
import { fakeDoc } from './helpers';
import { splitParams } from '../core/helpers';
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