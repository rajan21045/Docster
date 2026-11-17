import { LangSupport } from './types';

// Builds the Markdown for one file. level 1 = "# title", level 2 = "## title"
export function buildFileDocs(
	lines: string[],
	support: LangSupport,
	title: string,
	level: number
): { md: string; count: number } {
	const fileHeading = '#'.repeat(level);
	const fnHeading = '#'.repeat(level + 1);
	let md = `${fileHeading} ${title}\n\n`;
	let count = 0;

	for (let i = 0; i < lines.length; i++) {
		const fn = support.parse(lines[i]);
		if (!fn) {
			continue;
		}
		count++;
		const description = support.description(lines, i) || '_No description yet._';
		md += `${fnHeading} ${fn.name}(${fn.params.join(', ')})\n\n${description}\n\n`;
		if (fn.params.length) {
			md += '**Parameters**\n\n';
			md += fn.params.map(p => `- \`${p}\``).join('\n') + '\n\n';
		}
	}
	return { md, count };
}
