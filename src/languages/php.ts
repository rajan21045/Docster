import { makeBlockSupport, parseWith, splitParams } from '../core/helpers';

const PHP_PATTERN =
	/^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+&?(\w+)\s*\(([^)]*)\)/;

export const phpSupport = makeBlockSupport({
	ids: ['php'],
	parse: text =>
		parseWith(text, PHP_PATTERN, [], raw =>
			splitParams(raw)
				.map(p => p.match(/\$\w+/)?.[0] ?? '')
				.filter(Boolean)
		),
	returnTag: '@return',
	paramType: 'mixed',
	markers: ['#['],
});