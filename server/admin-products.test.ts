import { mockD1 } from '@zeyolabs/kit/cloudflare/d1/testing';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import type { ProductInput } from '../admin/products.schema';
import type { ShopDb } from '../db';

import { configureShopping, shopping } from '../config';
import * as schema from '../db/schema';
import { getProductForEdit, saveCategory, saveProduct } from './admin-products';
import { findProductRedirect } from './catalogue';

const SCHEMA = readFileSync(join(__dirname, '../__fixtures__/schema.sql'), 'utf8');

describe('saveProduct', () => {
	const ctx = mockD1({ migrations: [SCHEMA], schema });
	const db = () => ctx.db as unknown as ShopDb;
	beforeAll(() => configureShopping({ ...shopping(), db }));

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
		const cat = await saveCategory({ description: '', name: 'Tea', slug: 'tea', sortOrder: 0 });
		const part = await saveProduct({ ...base, name: 'Cup', sku: 'CUP', slug: 'cup' });
		const id = await saveProduct({
			...base,
			categoryIds: [cat],
			images: [{ alt: 'Tin', src: 'tea.avif' }],
			variationGroup: 'Size',
			variationLabel: '50g',
		});
		const [row] = await db().select().from(schema.products).where(eq(schema.products.id, id));
		expect(row.stock).toBe(0);

		await saveProduct({
			...base,
			categoryIds: [cat],
			components: [{ quantity: 2, sku: 'CUP' }],
			id,
			slug: 'green-tea',
		});
		const edit = await getProductForEdit(id);
		expect(edit).toMatchObject({
			categoryIds: [cat],
			components: [{ quantity: 2, sku: 'CUP' }],
			images: [],
			slug: 'green-tea',
			variationGroup: null,
		});
		expect(await findProductRedirect(db(), { legacySlug: 'tea', variantSku: null })).toBe(
			'green-tea'
		);
		// Going back to the old slug drops it as an alias.
		await saveProduct({ ...base, id, slug: 'tea' });
		const aliases = await db().select().from(schema.productSlugAliases);
		expect(aliases.map((a) => a.slug)).toEqual(['green-tea']);

		await expect(saveProduct({ ...base, sku: 'NEW', slug: 'cup' })).rejects.toThrow('slug');
		await expect(saveProduct({ ...base, sku: 'CUP', slug: 'new' })).rejects.toThrow('SKU');
		await expect(saveProduct({ ...base, id: part, sku: 'CUP', slug: 'green-tea' })).rejects.toThrow(
			'old link'
		);
	});
});
