import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ProductInput } from './schema';

import { shopTestDb } from '../__fixtures__/db';
import * as schema from '../db/schema';
import { CatalogueAdminService } from './admin.service.server';
import { CatalogueService } from './service.server';

describe('CatalogueAdminService.saveProduct', () => {
	const { db } = shopTestDb();

	const base: ProductInput = {
		active: true,
		categoryIds: [],
		comparePricePence: null,
		components: [],
		description: '',
		images: [],
		lowStockThreshold: null,
		massGrams: 100,
		maxPerOrder: 10,
		name: 'Tea',
		packSize: 1,
		pricePence: 1250,
		shortDescription: '',
		sku: 'TEA1',
		slug: 'tea',
		sortOrder: 0,
		variationGroup: null,
		variationLabel: null,
	};

	it('creates, edits, keeps the old slug as a redirect and sets parts', async () => {
		const admin = new CatalogueAdminService(db());
		const catalogue = new CatalogueService(db());
		const cat = await admin.saveCategory({
			description: '',
			name: 'Tea',
			slug: 'tea',
			sortOrder: 0,
		});
		const part = await admin.saveProduct({ ...base, name: 'Cup', sku: 'CUP', slug: 'cup' });
		const id = await admin.saveProduct({
			...base,
			categoryIds: [cat],
			images: [{ alt: 'Tin', src: 'tea.avif' }],
			variationGroup: 'Size',
			variationLabel: '50g',
		});
		const [row] = await db().select().from(schema.products).where(eq(schema.products.id, id));
		expect(row.stock).toBe(0);

		await admin.saveProduct({
			...base,
			categoryIds: [cat],
			components: [{ quantity: 2, sku: 'CUP' }],
			id,
			slug: 'green-tea',
		});
		const edit = await admin.productForEdit(id);
		expect(edit).toMatchObject({
			categoryIds: [cat],
			components: [{ quantity: 2, sku: 'CUP' }],
			images: [],
			slug: 'green-tea',
			variationGroup: null,
		});
		expect(await catalogue.redirect({ legacySlug: 'tea', variantSku: null })).toBe('green-tea');
		// Going back to the old slug drops it as an alias.
		await admin.saveProduct({ ...base, id, slug: 'tea' });
		const aliases = await db().select().from(schema.productSlugAliases);
		expect(aliases.map((a) => a.slug)).toEqual(['green-tea']);

		await expect(admin.saveProduct({ ...base, sku: 'NEW', slug: 'cup' })).rejects.toThrow('slug');
		await expect(admin.saveProduct({ ...base, sku: 'CUP', slug: 'new' })).rejects.toThrow('SKU');
		await expect(
			admin.saveProduct({ ...base, id: part, sku: 'CUP', slug: 'green-tea' })
		).rejects.toThrow('old link');
	});

	it('finds products by name or SKU, taking _ literally', async () => {
		const admin = new CatalogueAdminService(db());
		await admin.saveProduct({ ...base, name: 'Key_cap', sku: 'KC_1', slug: 'key-cap' });
		await admin.saveProduct({ ...base, name: 'Keyxcap', sku: 'KCX1', slug: 'keyx-cap' });
		expect((await admin.products('key_')).map((p) => p.name)).toEqual(['Key_cap']);
		expect((await admin.products('kcx')).map((p) => p.sku)).toEqual(['KCX1']);
	});
});
