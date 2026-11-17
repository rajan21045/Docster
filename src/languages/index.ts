import { LangSupport } from '../core/types';
import { cSupport } from './c';
import { csSupport } from './csharp';
import { dartSupport } from './dart';
import { goSupport } from './go';
import { javaSupport } from './java';
import { jsSupport } from './js';
import { phpSupport } from './php';
import { pySupport } from './python';

export const SUPPORTS: LangSupport[] = [
	jsSupport, dartSupport, pySupport, javaSupport, cSupport, csSupport, goSupport, phpSupport,
];
export const LANGUAGE_IDS = SUPPORTS.flatMap(s => s.ids);

export function getSupport(languageId: string): LangSupport | undefined {
	return SUPPORTS.find(s => s.ids.includes(languageId));
}

const EXT_TO_LANGUAGE: Record<string, string> = {
	js: 'javascript', jsx: 'javascriptreact', ts: 'typescript', tsx: 'typescriptreact',
	dart: 'dart', py: 'python', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
	cs: 'csharp', go: 'go', php: 'php',
};

export function languageIdForPath(path: string): string | undefined {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return EXT_TO_LANGUAGE[ext];
}
