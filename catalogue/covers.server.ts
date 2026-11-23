import { inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import { products } from '../db/schema';
import { Batches } from '../utils/batches';

export type Cover = { alt: string; src: string };

/** One column of a product's lowest-position photo: one index lookup per product, not every photo. */
function firstPhoto(column: 'alt' | 'src') {
	return sql<
		null | string
	>`(select pi.${sql.raw(column)} from product_images pi where pi.product_id = "products"."id" order by pi.position limit 1)`;
}

/** Each product's cover image: its lowest-position photo. */
export class CoverService {
	constructor(private readonly db: ShopDb) {}

	/** Cover per product id; products without photos are left out. */
	async covers(productIds: readonly number[]): Promise<Map<number, Cover>> {
		const rows = await Batches.rows(productIds, (slice) =>
			this.db
				.select({
					alt: firstPhoto('alt'),
					productId: products.id,
					src: firstPhoto('src'),
				})
				.from(products)
				.where(inArray(products.id, slice))
		);
		const covers = new Map<number, Cover>();
		for (const { alt, productId, src } of rows) {
			if (src !== null) covers.set(productId, { alt: alt ?? '', src });
		}
		return covers;
	}
}
