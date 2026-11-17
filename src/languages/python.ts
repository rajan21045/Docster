import { DEFAULT_BUILD_OPTIONS, LangSupport, PLACEHOLDER } from '../core/types';
import { splitParams } from '../core/utils';

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
	hasComment(lines, line) {
		if (line + 1 >= lines.length) {
			return false;
		}
		return /^[rRuU]?("""|''')/.test(lines[line + 1].trim());
	},

	build(indent, fn, opts = DEFAULT_BUILD_OPTIONS) {
		const inner = indent + opts.indentUnit;
		let s = `${inner}"""${PLACEHOLDER}${fn.name}\n`;
		if (opts.pythonStyle === 'numpy') {
			if (fn.params.length) {
				s += `\n${inner}Parameters\n${inner}----------\n`;
				s += fn.params.map(p => `${inner}${p} :\n`).join('');
			}
			return s + `\n${inner}Returns\n${inner}-------\n${inner}"""\n`;
		}
		if (fn.params.length) {
			s += `\n${inner}Args:\n`;
			s += fn.params.map(p => `${inner}${opts.indentUnit}${p}:\n`).join('');
		}
		return s + `\n${inner}Returns:\n${inner}"""\n`;
	},

	insertLine: (_lines, line) => line + 1,

	description(lines, line) {
		const out: string[] = [];
		for (let i = line + 1; i < lines.length; i++) {
			let t = lines[i].trim();
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
