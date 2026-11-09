import { LangSupport } from '../core/types';
import { PLACEHOLDER, splitParams } from '../core/helpers';

const PY_PATTERN = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/;

export const pySupport: LangSupport = {
	ids: ['python'],

	parse(text) {
		const m = text.match(PY_PATTERN);
		if (!m) {
			return undefined;
		}
		const params = splitParams(m[2])
			.map(p => p.split(/[:=]/)[0].trim().replace(/^\*+/, ''))
			.filter(p => p && p !== 'self' && p !== 'cls' && p !== '/');
		return { name: m[1], params };
	},

	// Python docstrings go INSIDE the function, right after the def line
	hasComment(doc, line) {
		if (line + 1 >= doc.lineCount) {
			return false;
		}
		const next = doc.lineAt(line + 1).text.trim();
		return /^[rRuU]?("""|''')/.test(next);
	},

	// Style comes from opts (google or numpy); extension.ts reads the setting
	build(indent, fn, opts) {
		const inner = indent + '    ';
		const style = opts?.pythonStyle ?? 'google';
		let s = `${inner}"""${PLACEHOLDER}${fn.name}\n`;
		if (style === 'numpy') {
			if (fn.params.length) {
				s += `\n${inner}Parameters\n${inner}----------\n`;
				s += fn.params.map(p => `${inner}${p} :\n`).join('');
			}
			return s + `\n${inner}Returns\n${inner}-------\n${inner}"""\n`;
		}
		if (fn.params.length) {
			s += `\n${inner}Args:\n`;
			s += fn.params.map(p => `${inner}    ${p}:\n`).join('');
		}
		return s + `\n${inner}Returns:\n${inner}"""\n`;
	},

	insertLine(_doc, line) {
		return line + 1;
	},

	description(doc, line) {
		const out: string[] = [];
		for (let i = line + 1; i < doc.lineCount; i++) {
			let t = doc.lineAt(i).text.trim();
			if (i === line + 1) {
				t = t.replace(/^[rRuU]?("""|''')/, '');
			}
			const closes = /("""|''')$/.test(t);
			t = t.replace(/("""|''')$/, '').trim();
			if (/^(Args|Arguments|Parameters|Returns|Raises):?$/.test(t)) {
				break;
			}
			if (!t) {
				if (out.length || closes) {
					break;
				}
				continue;
			}
			if (!t.startsWith(PLACEHOLDER)) {
				out.push(t);
			}
			if (closes) {
				break;
			}
		}
		return out.join(' ');
	},
};