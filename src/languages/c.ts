import { makeBlockSupport, parseWith, splitParams, lastWord } from '../core/helpers';

const C_PATTERN =
	/^\s*(?:(?:static|inline|extern|const|unsigned|signed|struct|enum|virtual|constexpr)\s+)*[\w:<>*&]+[\s*&]+(?:\w+::)*(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?(?:noexcept\s*)?\{?\s*$/;
const C_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'sizeof', 'defined'];

function parseCParams(raw: string): string[] {
	if (raw.trim() === '' || raw.trim() === 'void') {
		return [];
	}
	return splitParams(raw).map(lastWord).filter(p => p && p !== 'void');
}

export const cSupport = makeBlockSupport({
	ids: ['c', 'cpp'],
	parse: text => parseWith(text, C_PATTERN, C_SKIP, parseCParams),
	returnTag: '@return',
});