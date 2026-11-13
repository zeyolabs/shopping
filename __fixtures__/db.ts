import { mockD1 } from '@zeyolabs/kit/cloudflare/d1/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ShopDb } from '../db/index';

import * as schema from '../db/schema';

const SCHEMA = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

/**
 * A real in-memory D1 with the full shop schema for one test file, plus helpers that insert a
 * product or a paid order with sensible defaults.
 */
export function shopTestDb() {
	const ctx = mockD1({ migrations: [SCHEMA], schema });
	const db = () => ctx.db as unknown as ShopDb;
	let n = 0;

	async function product(values: Partial<typeof schema.products.$inferInsert> = {}) {
		n++;
		const [row] = await db()
			.insert(schema.products)
			.values({
				createdAt: 0,
				name: `Product ${n}`,
				pricePence: 1000,
				sku: `SKU${n}`,
				slug: `product-${n}`,
				stock: 10,
				...values,
			})
			.returning();
		return row;
	}

	async function order(
		status: 'cancelled' | 'paid' | 'shipped',
		productIds: number[],
		email = 'a@b.test'
	) {
		n++;
		const [address] = await db()
			.insert(schema.addresses)
			.values({ city: 'X', country: 'GB', createdAt: 0, line1: '1', name: 'A', postcode: 'N1' })
			.returning();
		const [row] = await db()
			.insert(schema.orders)
			.values({
				accessToken: `token${n}`,
				createdAt: n,
				email,
				number: `TS-ORD${String(n).padStart(3, '0')}`,
				paidAt: n,
				shippingAddressId: address.id,
				status,
				subtotalPence: 1000,
				totalPence: 1000,
			})
			.returning();
		for (const productId of productIds) {
			await db()
				.insert(schema.orderItems)
				.values({
					name: `P${productId}`,
					orderId: row.id,
					productId,
					quantity: 1,
					sku: `S${productId}-${n}`,
					unitPricePence: 1000,
				});
		}
		return row;
	}

	return { db, order, product };
}
