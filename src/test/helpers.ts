import { DocLike } from '../core/types';

export function fakeDoc(source: string): DocLike {
	const lines = source.split('\n');
	return { lineCount: lines.length, lineAt: n => ({ text: lines[n] }) };
}