import { asc, inArray } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import { productImages } from '../db/schema';
import { Batches } from '../utils/batches';

export type Cover = { alt: string; src: string };

/** Each product's cover image: its lowest-position photo. */
export class CoverService {
	constructor(private readonly db: ShopDb) {}

	/** Cover per product id; products without photos are left out. */
	async covers(productIds: readonly number[]): Promise<Map<number, Cover>> {
		const images = await Batches.rows(productIds, (slice) =>
			this.db
				.select({
					alt: productImages.alt,
					productId: productImages.productId,
					src: productImages.src,
				})
				.from(productImages)
				.where(inArray(productImages.productId, slice))
				.orderBy(asc(productImages.position))
		);
		const covers = new Map<number, Cover>();
		for (const { productId, ...image } of images) {
			if (!covers.has(productId)) covers.set(productId, image);
		}
		return covers;
	}
}
