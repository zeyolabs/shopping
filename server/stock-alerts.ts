import { logger } from '@zeyolabs/kit/server/logger';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { BackInStockEmailData } from '../emails/back-in-stock';

import { shopping } from '../config';
import { products, stockAlerts } from '../db/schema';
import { sellableSql } from './stock-service';

/** How many back-in-stock emails go out per run. The worker runs once a minute. */
export const BACK_IN_STOCK_BATCH = 50;

/** An SMTP error can carry the recipient's address, so logs get the failure's kind, not its text. */
const safeError = (what: string, error: unknown) =>
	new Error(`${what}: ${error instanceof Error ? error.name : 'unknown error'}`);

export type PendingAlert = BackInStockEmailData & {
	createdAt: number;
	id: number;
	productId: number;
};

/** Signups waiting on a product that is sellable again (a whole pack, or every component of a set), oldest first. Rows already marked notified are skipped. */
export async function pendingAlerts(limit = BACK_IN_STOCK_BATCH): Promise<PendingAlert[]> {
	return shopping()
		.db()
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

/**
 * Emails each alert once. A signup is claimed (deleted) before the send, so two overlapping runs
 * can't both email the same person: only the run whose delete took the row sends. If the send
 * fails the signup is put back and tried again on the next run; one failure never stops the rest.
 * The cost of claiming first: a Worker killed between the delete and the send loses that signup.
 */
export async function deliverAlerts(
	alerts: PendingAlert[],
	send: (alert: BackInStockEmailData) => Promise<void>,
	claim: (id: number) => Promise<boolean>,
	restore: (alert: PendingAlert) => Promise<void>
): Promise<{ failed: number; sent: number }> {
	let sent = 0;
	let failed = 0;
	for (const alert of alerts) {
		try {
			if (!(await claim(alert.id))) continue; // another run already took it
		} catch (error) {
			failed++;
			logger.error(error, { alertId: alert.id, op: 'backInStockClaim' });
			continue;
		}
		try {
			await send(alert);
			sent++;
		} catch (error) {
			failed++;
			logger.error(safeError('Back-in-stock send failed', error), {
				alertId: alert.id,
				op: 'backInStockEmail',
			});
			try {
				await restore(alert);
			} catch (restoreError) {
				logger.error(restoreError, { alertId: alert.id, op: 'backInStockRestore' });
			}
		}
	}
	return { failed, sent };
}

/** One run of the cron: email up to a batch of waiting customers and delete their signups. */
export async function sendBackInStockBatch(limit = BACK_IN_STOCK_BATCH) {
	const db = shopping().db();
	const { backInStock } = shopping().mail;
	// A shop without a back-in-stock email sends nothing and leaves the signups alone.
	if (!backInStock) return { failed: 0, sent: 0 };
	return deliverAlerts(
		await pendingAlerts(limit),
		({ email, pricePence, productName, slug }) =>
			backInStock({ email, pricePence, productName, slug }),
		async (id) => {
			const taken = await db
				.delete(stockAlerts)
				.where(eq(stockAlerts.id, id))
				.returning({ id: stockAlerts.id });
			return taken.length > 0;
		},
		async ({ createdAt, email, productId }) => {
			await db.insert(stockAlerts).values({ createdAt, email, productId }).onConflictDoNothing();
		}
	);
}
