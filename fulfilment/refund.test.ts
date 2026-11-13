import { describe, expect, it, vi } from 'vitest';

import { OrderRefunds, type RefundStripe } from './refund.server';
import { RefundSchema } from './schema';

/** A fake Stripe with one charge; each created refund adds to `amount_refunded`. */
function fakeStripe(amount: number, alreadyRefunded = 0) {
	const charge = { amount, amount_refunded: alreadyRefunded };
	const create = vi.fn(async (params: { amount: number }) => {
		charge.amount_refunded += params.amount;
	});
	const stripe: RefundStripe = {
		charges: { retrieve: async () => ({ ...charge }) },
		paymentIntents: { retrieve: async () => ({ latest_charge: 'ch_1' }) },
		refunds: { create },
	};
	return { create, stripe };
}

const order = { number: 'TS-ORD001', stripePaymentIntentId: 'pi_1' };

describe('OrderRefunds.run', () => {
	it('refunds part, reads the new total back and keys on what Stripe had refunded', async () => {
		const { create, stripe } = fakeStripe(1000);
		const result = await OrderRefunds.run(stripe, order, 400);
		expect(result).toEqual({ amount: 1000, fullyRefunded: false, refundedPence: 400 });
		expect(create).toHaveBeenCalledWith(
			{ amount: 400, metadata: { order: 'TS-ORD001' }, payment_intent: 'pi_1' },
			{ idempotencyKey: 'refund-TS-ORD001-0-400' }
		);
	});

	it('takes what is left from Stripe, so a refund we never recorded still counts', async () => {
		const { create, stripe } = fakeStripe(1000, 700);
		await expect(OrderRefunds.run(stripe, order, 400)).rejects.toThrow('Only £3.00 is left');
		expect(create).not.toHaveBeenCalled();
		const result = await OrderRefunds.run(stripe, order, 300);
		expect(result).toEqual({ amount: 1000, fullyRefunded: true, refundedPence: 1000 });
	});

	it('refuses an already fully refunded charge without calling Stripe', async () => {
		const { create, stripe } = fakeStripe(1000, 1000);
		await expect(OrderRefunds.run(stripe, order, 100)).rejects.toThrow('already fully refunded');
		expect(create).not.toHaveBeenCalled();
	});

	it('fails when Stripe fails, before anything is recorded', async () => {
		const { stripe } = fakeStripe(1000);
		stripe.refunds.create = async () => {
			throw new Error('stripe down');
		};
		await expect(OrderRefunds.run(stripe, order, 100)).rejects.toThrow('stripe down');
	});
});

describe('RefundSchema', () => {
	const parse = (amount: string) => RefundSchema.safeParse({ amount, number: 'TS-ORD001' });

	it('reads pounds as pence', () => {
		expect(parse('12.50').data?.amount).toBe(1250);
		expect(parse('£1,000').data?.amount).toBe(100_000);
	});

	it.each(['', '0', '0.00', '12.505', '-5', 'abc', '£1,0x'])('rejects %j', (value) => {
		expect(parse(value).success).toBe(false);
	});
});
