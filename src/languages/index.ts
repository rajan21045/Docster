import { LangSupport } from '../core/types';
import { jsSupport } from './javascript';
import { dartSupport } from './dart';
import { pySupport } from './python';
import { javaSupport } from './java';
import { cSupport } from './c';
import { csSupport } from './csharp';
import { goSupport } from './go';
import { phpSupport } from './php';

export const SUPPORTS: LangSupport[] = [
	jsSupport, dartSupport, pySupport, javaSupport,
	cSupport, csSupport, goSupport, phpSupport,
];
export const LANGUAGE_IDS = SUPPORTS.flatMap(s => s.ids);

export function getSupport(languageId: string): LangSupport | undefined {
	return SUPPORTS.find(s => s.ids.includes(languageId));
}