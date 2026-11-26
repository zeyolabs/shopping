import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { categories, productCategories } from '../db/schema';
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

describe('CatalogueService listings', () => {
	const { db, product } = shopTestDb();

	it('lists products in stock first, keeping their order within each half', async () => {
		await product({ name: 'A sold out', sortOrder: 1, stock: 0 });
		await product({ name: 'B in stock', sortOrder: 2 });
		await product({ name: 'C sold out', sortOrder: 3, stock: 0 });
		await product({ name: 'D in stock', sortOrder: 4 });
		const names = (await new CatalogueService(db()).products()).map((p) => p.name);
		expect(names).toEqual(['B in stock', 'D in stock', 'A sold out', 'C sold out']);
	});
});

describe('CatalogueService.productPage', () => {
	const { db, product } = shopTestDb();

	it('pages active products with the sellable ones first across pages', async () => {
		for (let i = 0; i < 30; i++) {
			await product({ name: `P${String(i).padStart(2, '0')}`, sortOrder: i, stock: i % 2 ? 5 : 0 });
		}
		await product({ active: false, name: 'Hidden' });
		const catalogue = new CatalogueService(db());
		const first = await catalogue.productPage(1);
		expect(first).toMatchObject({ page: 1, pages: 2, total: 30 });
		expect(first.products).toHaveLength(24);
		expect(first.products.slice(0, 15).every((p) => p.stock > 0)).toBe(true);
		expect(first.products[15].stock).toBe(0);
		const second = await catalogue.productPage(2);
		expect(second.products.map((p) => p.name)).toEqual(['P18', 'P20', 'P22', 'P24', 'P26', 'P28']);
	});
});

describe('CatalogueService.sitemapEntries', () => {
	const { db, product } = shopTestDb();

	it('dates a product by its creation or last restock, whichever is later', async () => {
		const created = await product({ createdAt: Date.UTC(2026, 0, 2), slug: 'created' });
		const restocked = await product({
			createdAt: Date.UTC(2026, 0, 2),
			restockedAt: Date.UTC(2026, 5, 7, 12),
			slug: 'restocked',
		});
		await product({ active: false, slug: 'hidden' });
		const entries = await new CatalogueService(db()).sitemapEntries();
		expect(entries.products.toSorted()).toEqual(['created', 'restocked']);
		expect(entries.lastmod.products).toEqual({
			[created.slug]: '2026-01-02',
			[restocked.slug]: '2026-06-07',
		});
	});
});

describe('CatalogueService.product categories', () => {
	const { db, product } = shopTestDb();

	it('lists the product categories', async () => {
		const item = await product({ slug: 'mug' });
		const [category] = await db()
			.insert(categories)
			.values({ name: 'Mugs', slug: 'mugs' })
			.returning();
		await db().insert(productCategories).values({ categoryId: category.id, productId: item.id });
		const found = await new CatalogueService(db()).product('mug');
		expect(found?.categories).toEqual([{ name: 'Mugs', slug: 'mugs' }]);
	});
});
