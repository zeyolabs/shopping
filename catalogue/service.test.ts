import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { Search } from './library';
import { CatalogueService } from './service.server';

describe('Search.words', () => {
	it('splits and caps words', () => {
		expect(Search.words('  Green   TEA ')).toEqual(['green', 'tea']);
		expect(Search.words('a b c d e f g h')).toHaveLength(6);
	});

	it('cuts a long word so its LIKE pattern fits D1 (50 bytes), escapes and multibyte included', () => {
		for (const word of ['x'.repeat(90), '%'.repeat(40), '茶'.repeat(30), '_a'.repeat(30)]) {
			const [fitted] = Search.words(word);
			expect(fitted.length).toBeGreaterThan(0);
			expect(new TextEncoder().encode(Search.pattern(fitted)).length).toBeLessThanOrEqual(50);
		}
	});
});

describe('CatalogueService.search', () => {
	const { db, product } = shopTestDb();

	it('needs every word, ignores inactive products and treats % literally', async () => {
		const tea = await product({ description: 'Smooth Korean leaf', name: 'Sejak Green Tea' });
		await product({ active: false, name: 'Hidden Green Tea' });
		await product({ name: '100% Cotton Cloth' });
		const catalogue = new CatalogueService(db());
		expect((await catalogue.search('green korean')).map((p) => p.id)).toEqual([tea.id]);
		expect((await catalogue.search('tea')).map((p) => p.name)).toEqual(['Sejak Green Tea']);
		expect((await catalogue.search('%')).map((p) => p.name)).toEqual(['100% Cotton Cloth']);
		expect(await catalogue.search('   ')).toEqual([]);
	});
});

describe('CatalogueService over D1 limits', () => {
	const { db, product } = shopTestDb();

	it('lists and searches more products than D1 takes parameters (100)', async () => {
		for (let i = 0; i < 150; i++) await product({ name: `Keycap set ${i}` });
		const catalogue = new CatalogueService(db());
		const all = await catalogue.products();
		expect(all).toHaveLength(150);
		expect(all.every((p) => p.stock === 10)).toBe(true);
		expect(await catalogue.search('keycap')).toHaveLength(48);
	});
});
