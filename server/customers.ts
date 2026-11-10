import type Stripe from 'stripe';

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

import type { ShopDb } from '../db';

import { customers, orders } from '../db/schema';
import { orderPath } from '../order-links';

/**
 * Signed-in customers. Sign-in itself is the app's (kit's passwordless auth); the shop only needs
 * the email: orders belong to an email address, so an account sees every order placed with it,
 * including guest orders from before the account existed.
 */
export class CustomerService {
	constructor(private readonly db: ShopDb) {}

	/** Paid orders placed with this email, newest first, with the private link to each. */
	async orders(email: string, limit = 50) {
		const rows = await this.db
			.select({
				accessToken: orders.accessToken,
				createdAt: orders.createdAt,
				number: orders.number,
				shippedAt: orders.shippedAt,
				status: orders.status,
				totalPence: orders.totalPence,
			})
			.from(orders)
			.where(
				and(eq(sql`lower(${orders.email})`, email.trim().toLowerCase()), isNotNull(orders.paidAt))
			)
			.orderBy(desc(orders.createdAt))
			.limit(limit);
		return rows.map(({ accessToken, ...order }) => ({
			...order,
			path: accessToken ? orderPath(order.number, accessToken) : null,
		}));
	}

	/** The customer's Stripe Customer id, creating the Customer on first checkout. */
	async stripeCustomerId(stripe: Stripe, email: string, now = Date.now()): Promise<string> {
		const key = email.trim().toLowerCase();
		const found = await this.db.query.customers.findFirst({ where: eq(customers.email, key) });
		if (found) return found.stripeCustomerId;
		const customer = await stripe.customers.create(
			{ email: key },
			{ idempotencyKey: `cus:${key}` }
		);
		await this.db
			.insert(customers)
			.values({ createdAt: now, email: key, stripeCustomerId: customer.id })
			.onConflictDoNothing();
		const row = await this.db.query.customers.findFirst({ where: eq(customers.email, key) });
		return row?.stripeCustomerId ?? customer.id;
	}
}
