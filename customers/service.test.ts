import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { CustomerService } from './service.server';

describe('CustomerService.orders', () => {
	const { db, order, product } = shopTestDb();

	it('lists paid orders for the email, any case, newest first', async () => {
		const p = await product();
		const first = await order('paid', [p.id], 'Kim@Example.test');
		const second = await order('shipped', [p.id], 'kim@example.test');
		await order('paid', [p.id], 'someone@else.test');
		const customers = new CustomerService(db());
		const list = await customers.orders(' KIM@example.test ');
		expect(list.map((o) => o.number)).toEqual([second.number, first.number]);
		expect(list[0].path).toBe(`/order/${second.number}/${second.accessToken}`);
	});
});
