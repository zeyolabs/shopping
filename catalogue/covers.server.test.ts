import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import * as schema from '../db/schema';
import { CoverService } from './covers.server';

describe('CoverService', () => {
	const { db, product } = shopTestDb();

	it("returns each product's lowest-position photo and leaves out products without one", async () => {
		const a = await product();
		const b = await product();
		const none = await product();
		await db()
			.insert(schema.productImages)
			.values([
				{ alt: 'a back', position: 2, productId: a.id, src: 'a2.avif' },
				{ alt: 'a front', position: 0, productId: a.id, src: 'a0.avif' },
				{ alt: 'a side', position: 1, productId: a.id, src: 'a1.avif' },
				{ alt: 'b only', position: 3, productId: b.id, src: 'b3.avif' },
			]);
		const covers = await new CoverService(db()).covers([a.id, b.id, none.id]);
		expect(covers.get(a.id)).toEqual({ alt: 'a front', src: 'a0.avif' });
		expect(covers.get(b.id)).toEqual({ alt: 'b only', src: 'b3.avif' });
		expect(covers.has(none.id)).toBe(false);
		expect(covers.size).toBe(2);
	});

	it('works across more products than one batch holds', async () => {
		const ids: number[] = [];
		for (let i = 0; i < 120; i++) {
			const p = await product();
			ids.push(p.id);
			await db()
				.insert(schema.productImages)
				.values([
					{ alt: 'second', position: 1, productId: p.id, src: `${p.id}-1.avif` },
					{ alt: 'first', position: 0, productId: p.id, src: `${p.id}-0.avif` },
				]);
		}
		const covers = await new CoverService(db()).covers(ids);
		expect(covers.size).toBe(120);
		expect(covers.get(ids[100])?.src).toBe(`${ids[100]}-0.avif`);
	});
});
