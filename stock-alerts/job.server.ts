import { logger } from '@zeyolabs/kit/server/logger';

import type { BackInStockEmailData } from './email';

import { shopping } from '../config';
import { type PendingAlert, StockAlertService } from './service.server';

type Result = { failed: number; sent: number };

/** How many emails go out per run. */
const BATCH = 50;

/** An SMTP error can carry the recipient's address, so logs get the failure's kind, not its text. */
const safeError = (what: string, error: unknown) =>
	new Error(`${what}: ${error instanceof Error ? error.name : 'unknown error'}`);

/**
 * Emails each alert once. A signup is claimed (deleted) before the send, so two overlapping runs
 * can't both email the same person: only the run whose delete took the row sends. If the send
 * fails the signup is put back and tried again next run; one failure never stops the rest. The
 * cost of claiming first: a Worker killed between the delete and the send loses that signup.
 */
async function deliver(
	alerts: PendingAlert[],
	send: (alert: BackInStockEmailData) => Promise<void>,
	claim: (id: number) => Promise<boolean>,
	restore: (alert: PendingAlert) => Promise<void>
): Promise<Result> {
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

/** One run: email up to a batch of waiting customers and delete their signups. */
async function run(limit = BATCH): Promise<Result> {
	const { db, mail } = shopping();
	const { backInStock } = mail;
	// A shop without a back-in-stock email sends nothing and leaves the signups alone.
	if (!backInStock) return { failed: 0, sent: 0 };
	const service = new StockAlertService(db());
	return deliver(
		await service.pending(limit),
		({ email, pricePence, productName, slug }) =>
			backInStock({ email, pricePence, productName, slug }),
		(id) => service.claim(id),
		(alert) => service.restore(alert)
	);
}

/** The back-in-stock cron. The app's worker calls `BackInStockJob.run()` once a minute. */
export const BackInStockJob = { BATCH, deliver, run };
