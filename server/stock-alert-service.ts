import { and, eq } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { products, stockAlerts } from '../db/schema';

/**
 * Data access for "tell me when it's back" signups. It takes the db it works on; it checks no
 * permissions and sends nothing (the back-in-stock job in `stock-alerts.ts` does the sending).
 */
export class StockAlertService {
	constructor(private readonly db: ShopDb) {}

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
