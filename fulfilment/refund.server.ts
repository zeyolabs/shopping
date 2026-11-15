import { Error400 } from '@zeyolabs/kit/utils/errors';

import { Money } from '../utils/money';

/** The slice of the Stripe SDK refunds use, so a test can pass a fake. */
export type RefundStripe = {
	charges: { retrieve(id: string): Promise<{ amount: number; amount_refunded: number }> };
	paymentIntents: {
		retrieve(id: string): Promise<{ latest_charge: null | string | { id: string } }>;
	};
	refunds: {
		create(
			params: { amount: number; metadata: Record<string, string>; payment_intent: string },
			options: { idempotencyKey: string }
		): Promise<unknown>;
	};
};

/**
 * Refunds with Stripe as the source of truth. What was already refunded is read from the charge,
 * not from our database, so a refund Stripe accepted but we failed to record (or one made in the
 * Stripe dashboard) is never refunded twice. After refunding, the new total is read back so the
 * caller records an absolute amount: recording twice, or two admins at once, ends in the same value.
 */
export const OrderRefunds = {
	async run(
		stripe: RefundStripe,
		order: { number: string; stripePaymentIntentId: string },
		pence: number
	): Promise<{ amount: number; fullyRefunded: boolean; refundedPence: number }> {
		const charge = await OrderRefunds.charge(stripe, order.stripePaymentIntentId);
		const left = charge.amount - charge.amount_refunded;
		if (pence > left) {
			throw Error400(
				left > 0
					? `Only ${Money.format(left)} is left to refund on this order.`
					: 'This order is already fully refunded.'
			);
		}
		// Keyed on what Stripe has refunded so far: a same-amount retry or double click gets the same
		// refund back, a different amount gets its own.
		await stripe.refunds.create(
			{
				amount: pence,
				metadata: { order: order.number },
				payment_intent: order.stripePaymentIntentId,
			},
			{ idempotencyKey: `refund-${order.number}-${charge.amount_refunded}-${pence}` }
		);
		const after = await OrderRefunds.charge(stripe, order.stripePaymentIntentId);
		return {
			amount: after.amount,
			fullyRefunded: after.amount_refunded >= after.amount,
			refundedPence: after.amount_refunded,
		};
	},

	async charge(stripe: RefundStripe, paymentIntentId: string) {
		const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
		const id =
			typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
		if (!id) throw Error400('This payment has no charge to refund.');
		return stripe.charges.retrieve(id);
	},
};
