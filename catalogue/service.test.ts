import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { Search } from './library';
import { CatalogueService } from './service.server';

describe('Search.words', () => {
	it('splits and caps words', () => {
		expect(Search.words('  Green   TEA ')).toEqual(['green', 'tea']);
		expect(Search.words('a b c d e f g h')).toHaveLength(6);
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
