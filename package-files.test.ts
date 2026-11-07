import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The package ships as source, listed in `files`. A relative import of a file that is not listed
// works in the repo but fails in every consumer (2026.11.10 shipped without stock.ts). This test
// follows every relative import of every shipped file and checks the target is shipped too.

const root = __dirname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { files: string[] };
const included = pkg.files.filter((f) => !f.startsWith('!'));

const isShipped = (file: string) => {
	const rel = relative(root, file).replaceAll('\\', '/');
	return included.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
};

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (name === 'node_modules') return [];
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

const shippedSource = included
	.flatMap((entry) => {
		const full = join(root, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	})
	.filter((f) => /\.(ts|svelte)$/.test(f) && !f.endsWith('.test.ts'));

function resolveImport(from: string, specifier: string): string | undefined {
	const base = resolve(dirname(from), specifier);
	return [base, `${base}.ts`, `${base}.svelte`, join(base, 'index.ts')].find(
		(candidate) => existsSync(candidate) && statSync(candidate).isFile()
	);
}

describe('package files', () => {
	it('ships every file that a shipped file imports by a relative path', () => {
		const missing: string[] = [];
		for (const file of shippedSource) {
			const source = readFileSync(file, 'utf8');
			for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
				const target = resolveImport(file, match[1]);
				if (target && !isShipped(target)) {
					missing.push(
						`${relative(root, file)} imports ${relative(root, target)}, which is not in "files"`
					);
				}
			}
		}
		expect(missing).toEqual([]);
	});
});
