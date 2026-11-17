export interface ParsedFunction {
	name: string;
	params: string[];
}

export interface BuildOptions {
	/** One level of indentation, e.g. "    " or "\t". Used by Python docstrings. */
	indentUnit: string;
	pythonStyle: 'google' | 'numpy';
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { indentUnit: '    ', pythonStyle: 'google' };

/** Pure language support: works on plain strings, never on vscode objects. */
export interface LangSupport {
	ids: string[];
	parse(text: string): ParsedFunction | undefined;
	hasComment(lines: string[], line: number): boolean;
	build(indent: string, fn: ParsedFunction, opts?: BuildOptions): string;
	/** Line index where the generated comment should be inserted (column 0). */
	insertLine(lines: string[], line: number): number;
	description(lines: string[], line: number): string;
}

export const PLACEHOLDER = 'Description of ';
