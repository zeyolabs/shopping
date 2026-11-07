import { Error404 } from '@zeyolabs/kit/utils/errors';
import { asc, count, eq, sql } from 'drizzle-orm';

import { shopping } from '../config';
import { products, stockAlerts } from '../db/schema';

const getDb = () => shopping().db();

/** Every product with its stock and how many customers are waiting for it, sold-out first. */
export async function listStock() {
	return getDb()
		.select({
			active: products.active,
			id: products.id,
			name: products.name,
			sku: products.sku,
			stock: products.stock,
			variationLabel: products.variationLabel,
			waiting: sql<number>`(select ${count()} from ${stockAlerts} where ${stockAlerts.productId} = ${products.id})`,
		})
		.from(products)
		.orderBy(asc(sql`${products.stock} > 0`), asc(products.name), asc(products.id));
}

/** Sets a product's stock. Customers waiting on it are emailed by the stock-alerts cron, not here. */
export async function setStock(productId: number, stock: number) {
	const updated = await getDb()
		.update(products)
		.set({ stock })
		.where(eq(products.id, productId))
		.returning({ id: products.id });
	if (updated.length === 0) throw Error404('Product not found.');
}
