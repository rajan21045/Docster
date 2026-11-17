export interface DocLike {
	lineCount: number;
	lineAt(n: number): { text: string };
}

export interface ParsedFunction {
	name: string;
	params: string[];
}

export interface BuildOptions {
	pythonStyle?: 'google' | 'numpy';
}

export interface LangSupport {
	ids: string[];
	parse(text: string): ParsedFunction | undefined;
	hasComment(doc: DocLike, line: number): boolean;
	build(indent: string, fn: ParsedFunction, opts?: BuildOptions): string;
	insertLine(doc: DocLike, line: number): number;
	description(doc: DocLike, line: number): string;
}