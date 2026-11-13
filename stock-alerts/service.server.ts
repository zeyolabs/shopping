import { and, asc, eq, isNull } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { BackInStockEmailData } from './email';

import { products, stockAlerts } from '../db/schema';
import { sellableSql } from '../stock/service.server';

export type PendingAlert = BackInStockEmailData & {
	createdAt: number;
	id: number;
	productId: number;
};

/**
 * Data access for "tell me when it's back" signups. It checks no permissions and sends nothing
 * (the back-in-stock job does the sending).
 */
export class StockAlertService {
	constructor(private readonly db: ShopDb) {}

	/** Takes a signup before its email is sent. False when another run already took it. */
	async claim(id: number): Promise<boolean> {
		const taken = await this.db
			.delete(stockAlerts)
			.where(eq(stockAlerts.id, id))
			.returning({ id: stockAlerts.id });
		return taken.length > 0;
	}

	/**
	 * Signups waiting on a product that is sellable again (a whole pack, or every component of a
	 * set), oldest first. Rows already marked notified are skipped.
	 */
	async pending(limit: number): Promise<PendingAlert[]> {
		return this.db
			.select({
				createdAt: stockAlerts.createdAt,
				email: stockAlerts.email,
				id: stockAlerts.id,
				pricePence: products.pricePence,
				productId: stockAlerts.productId,
				productName: products.name,
				slug: products.slug,
			})
			.from(stockAlerts)
			.innerJoin(products, eq(products.id, stockAlerts.productId))
			.where(and(sellableSql, eq(products.active, true), isNull(stockAlerts.notifiedAt)))
			.orderBy(asc(stockAlerts.id))
			.limit(limit);
	}

	/** Puts a claimed signup back after a failed send, so the next run tries again. */
	async restore({ createdAt, email, productId }: PendingAlert): Promise<void> {
		await this.db.insert(stockAlerts).values({ createdAt, email, productId }).onConflictDoNothing();
	}

	/**
	 * Adds a signup for an active product and returns the product's name, or null when there is no
	 * such active product. Signing up twice is fine and is not reported, so a caller cannot tell
	 * whether an address was already on the list.
	 */
	async subscribe(email: string, productId: number): Promise<null | { productName: string }> {
		const product = await this.db.query.products.findFirst({
			where: and(eq(products.id, productId), eq(products.active, true)),
		});
		if (!product) return null;
		await this.db
			.insert(stockAlerts)
			.values({ createdAt: Date.now(), email: email.toLowerCase(), productId })
			.onConflictDoNothing();
		return { productName: product.name };
	}
}
