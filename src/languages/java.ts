import { makeBlockSupport, parseWith, splitParams, lastWord } from '../core/helpers';

const JAVA_PATTERN =
	/^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*(?:<[^()]*>\s+)?[\w.]+(?:<[^()]*>)?(?:\[\])*\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$/;
const JAVA_SKIP = ['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'new', 'synchronized', 'throw'];

export const javaSupport = makeBlockSupport({
	ids: ['java'],
	parse: text =>
		parseWith(text, JAVA_PATTERN, JAVA_SKIP, raw => splitParams(raw).map(lastWord).filter(Boolean)),
	returnTag: '@return',
	markers: ['@'],
});