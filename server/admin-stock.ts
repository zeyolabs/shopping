import { asc, count, sql } from 'drizzle-orm';

import { shopping } from '../config';
import { products, stockAlerts } from '../db/schema';
import { StockService } from './stock-service';

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

/** Sets a product's stock in single units. Customers waiting on it are emailed by the stock-alerts cron, not here. */
export async function setStock(productId: number, stock: number) {
	await new StockService(getDb()).setStock(productId, stock);
}
