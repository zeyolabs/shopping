import { describe, expect, it, vi } from 'vitest';

import type { PendingAlert } from './service.server';

import { BackInStockJob } from './job.server';

vi.mock('@zeyolabs/kit/server/logger', () => ({ logger: { error: vi.fn() } }));

const alert = (id: number): PendingAlert => ({
	createdAt: 1000 + id,
	email: `person${id}@example.com`,
	id,
	pricePence: 1200,
	productId: 7,
	productName: 'Test tea',
	slug: 'test-tea',
});

describe('BackInStockJob.deliver', () => {
	it('claims each alert before sending it', async () => {
		const order: string[] = [];
		const result = await BackInStockJob.deliver(
			[alert(1), alert(2)],
			async ({ email }) => void order.push(`send ${email}`),
			async (id) => {
				order.push(`claim ${id}`);
				return true;
			},
			async () => {}
		);
		expect(result).toEqual({ failed: 0, sent: 2 });
		expect(order).toEqual([
			'claim 1',
			'send person1@example.com',
			'claim 2',
			'send person2@example.com',
		]);
	});

	it('does not send an alert another run already claimed', async () => {
		const send = vi.fn();
		const result = await BackInStockJob.deliver(
			[alert(1)],
			send,
			async () => false,
			async () => {}
		);
		expect(result).toEqual({ failed: 0, sent: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('puts a failed send back and carries on with the rest', async () => {
		const restored: number[] = [];
		const result = await BackInStockJob.deliver(
			[alert(1), alert(2), alert(3)],
			async ({ email }) => {
				if (email === 'person2@example.com') throw new Error('SES said no');
			},
			async () => true,
			async ({ id }) => void restored.push(id)
		);
		expect(result).toEqual({ failed: 1, sent: 2 });
		expect(restored).toEqual([2]);
	});

	it('skips an alert whose claim fails, without sending', async () => {
		const send = vi.fn();
		const result = await BackInStockJob.deliver(
			[alert(1)],
			send,
			async () => {
				throw new Error('D1 down');
			},
			async () => {}
		);
		expect(result).toEqual({ failed: 1, sent: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('keeps going when putting a failed alert back also fails', async () => {
		const result = await BackInStockJob.deliver(
			[alert(1), alert(2)],
			async ({ email }) => {
				if (email === 'person1@example.com') throw new Error('SES said no');
			},
			async () => true,
			async () => {
				throw new Error('D1 down');
			}
		);
		expect(result).toEqual({ failed: 1, sent: 1 });
	});

	it('does nothing for an empty list', async () => {
		const send = vi.fn();
		expect(await BackInStockJob.deliver([], send, vi.fn(), vi.fn())).toEqual({
			failed: 0,
			sent: 0,
		});
		expect(send).not.toHaveBeenCalled();
	});
});
