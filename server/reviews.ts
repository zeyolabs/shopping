import { and, asc, avg, count, desc, eq, inArray } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { orderItems, orders, products, reviews, type ReviewStatus } from '../db/schema';

/** Orders in these states can be reviewed: the customer has paid (and maybe received it). */
const REVIEWABLE = ['paid', 'shipped'] as const;
const SHOWN = 20;

export type ReviewInput = {
	body: string;
	name: string;
	productId: number;
	rating: number;
	title: string;
};

/** Reviews: data access only (who may write one is decided by the caller holding the order). */
export class ReviewService {
	constructor(private readonly db: ShopDb) {}

	async countPending(): Promise<number> {
		const [row] = await this.db
			.select({ n: count() })
			.from(reviews)
			.where(eq(reviews.status, 'pending'));
		return row?.n ?? 0;
	}

	/** The order's products, each with the review already written for it, if any. */
	async forOrder(orderId: number) {
		const items = await this.db
			.selectDistinct({ name: orderItems.name, productId: orderItems.productId })
			.from(orderItems)
			.innerJoin(products, eq(products.id, orderItems.productId))
			.where(eq(orderItems.orderId, orderId))
			.orderBy(asc(orderItems.name));
		const written = await this.db
			.select({ productId: reviews.productId, rating: reviews.rating, status: reviews.status })
			.from(reviews)
			.where(eq(reviews.orderId, orderId));
		const byProduct = new Map(written.map((r) => [r.productId, r]));
		return items.flatMap((item) =>
			item.productId === null
				? []
				: [{ name: item.name, productId: item.productId, review: byProduct.get(item.productId) }]
		);
	}

	/** Approved reviews of a product, newest first, with the average and count over all of them. */
	async forProduct(productId: number) {
		const shown = and(eq(reviews.productId, productId), eq(reviews.status, 'approved'));
		const [summary] = await this.db
			.select({ average: avg(reviews.rating), count: count() })
			.from(reviews)
			.where(shown);
		const list = await this.db
			.select({
				body: reviews.body,
				createdAt: reviews.createdAt,
				id: reviews.id,
				name: reviews.name,
				rating: reviews.rating,
				title: reviews.title,
			})
			.from(reviews)
			.where(shown)
			.orderBy(desc(reviews.createdAt))
			.limit(SHOWN);
		return {
			average: summary?.count ? Math.round(Number(summary.average) * 10) / 10 : null,
			count: summary?.count ?? 0,
			list,
		};
	}

	/** Reviews in one state for the admin, newest first, with the product and order they belong to. */
	async list(status: ReviewStatus, limit = 100) {
		return this.db
			.select({
				body: reviews.body,
				createdAt: reviews.createdAt,
				email: orders.email,
				id: reviews.id,
				name: reviews.name,
				orderNumber: orders.number,
				productName: products.name,
				productSlug: products.slug,
				rating: reviews.rating,
				status: reviews.status,
				title: reviews.title,
			})
			.from(reviews)
			.innerJoin(products, eq(products.id, reviews.productId))
			.innerJoin(orders, eq(orders.id, reviews.orderId))
			.where(eq(reviews.status, status))
			.orderBy(desc(reviews.createdAt))
			.limit(limit);
	}

	async moderate(id: number, status: 'approved' | 'rejected', now = Date.now()) {
		await this.db.update(reviews).set({ moderatedAt: now, status }).where(eq(reviews.id, id));
	}

	/**
	 * Saves a pending review of one of the order's products. False when the order cannot be
	 * reviewed, the product is not in it, or it was already reviewed from this order.
	 */
	async submit(orderId: number, input: ReviewInput, now = Date.now()): Promise<boolean> {
		const [order] = await this.db
			.select({ status: orders.status })
			.from(orders)
			.where(eq(orders.id, orderId))
			.limit(1);
		if (!order || !(REVIEWABLE as readonly string[]).includes(order.status)) return false;
		const [item] = await this.db
			.select({ id: orderItems.id })
			.from(orderItems)
			.where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, input.productId)))
			.limit(1);
		if (!item) return false;
		const inserted = await this.db
			.insert(reviews)
			.values({ ...input, createdAt: now, orderId, status: 'pending' })
			.onConflictDoNothing()
			.returning({ id: reviews.id });
		return inserted.length > 0;
	}

	/** Average rating and count for several products, for product cards. */
	async summaries(productIds: readonly number[]) {
		const out = new Map<number, { average: number; count: number }>();
		for (let i = 0; i < productIds.length; i += 90) {
			const rows = await this.db
				.select({ average: avg(reviews.rating), count: count(), productId: reviews.productId })
				.from(reviews)
				.where(
					and(
						inArray(reviews.productId, productIds.slice(i, i + 90)),
						eq(reviews.status, 'approved')
					)
				)
				.groupBy(reviews.productId);
			for (const r of rows)
				out.set(r.productId, { average: Math.round(Number(r.average) * 10) / 10, count: r.count });
		}
		return out;
	}
}
