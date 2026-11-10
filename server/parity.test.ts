import { mockD1 } from '@zeyolabs/kit/cloudflare/d1/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ShopDb } from '../db';

import * as schema from '../db/schema';
import { BundleService } from './bundles';
import { searchProducts, searchWords } from './catalogue';
import { CustomerService } from './customers';
import { ReviewService } from './reviews';

const SCHEMA = readFileSync(join(__dirname, '../__fixtures__/schema.sql'), 'utf8');

describe('search, reviews, bundles and customer orders', () => {
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

	describe('search', () => {
		it('splits and caps words', () => {
			expect(searchWords('  Green   TEA ')).toEqual(['green', 'tea']);
			expect(searchWords('a b c d e f g h')).toHaveLength(6);
		});

		it('needs every word, ignores inactive products and treats % literally', async () => {
			const tea = await product({ description: 'Smooth Korean leaf', name: 'Sejak Green Tea' });
			await product({ active: false, name: 'Hidden Green Tea' });
			await product({ name: '100% Cotton Cloth' });
			const hits = await searchProducts(db(), 'green korean');
			expect(hits.map((p) => p.id)).toEqual([tea.id]);
			expect((await searchProducts(db(), 'tea')).map((p) => p.name)).toEqual(['Sejak Green Tea']);
			expect((await searchProducts(db(), '%')).map((p) => p.name)).toEqual(['100% Cotton Cloth']);
			expect(await searchProducts(db(), '   ')).toEqual([]);
		});
	});

	describe('reviews', () => {
		it('lets a buyer review each item once and shows it only when approved', async () => {
			const p = await product();
			const other = await product();
			const o = await order('paid', [p.id]);
			const reviews = new ReviewService(db());
			const input = {
				body: 'Lovely tea, would buy again',
				name: 'Ann',
				productId: p.id,
				rating: 4,
				title: '',
			};
			expect(await reviews.submit(o.id, input)).toBe(true);
			expect(await reviews.submit(o.id, input)).toBe(false);
			expect(await reviews.submit(o.id, { ...input, productId: other.id })).toBe(false);
			expect((await reviews.forOrder(o.id))[0].review?.status).toBe('pending');

			expect((await reviews.forProduct(p.id)).count).toBe(0);
			const [pending] = await reviews.list('pending');
			await reviews.moderate(pending.id, 'approved');
			const shown = await reviews.forProduct(p.id);
			expect(shown).toMatchObject({ average: 4, count: 1 });
			expect((await reviews.summaries([p.id])).get(p.id)).toEqual({ average: 4, count: 1 });
			expect(await reviews.countPending()).toBe(0);
		});

		it('refuses cancelled orders', async () => {
			const p = await product();
			const o = await order('cancelled', [p.id]);
			const ok = await new ReviewService(db()).submit(o.id, {
				body: 'Should not be saved',
				name: 'B',
				productId: p.id,
				rating: 5,
				title: '',
			});
			expect(ok).toBe(false);
		});
	});

	describe('bundles', () => {
		it('saves steps by SKU and expands a valid choice into basket lines', async () => {
			const board = await product({ sku: 'BOARD' });
			const red = await product({ sku: 'RED' });
			const blue = await product({ sku: 'BLUE' });
			const gone = await product({ sku: 'GONE', stock: 0 });
			const bundles = new BundleService(db());
			const id = await bundles.save({
				active: true,
				description: '',
				image: null,
				name: 'Starter',
				slug: 'starter',
				sortOrder: 0,
				steps: [
					{ description: '', maxChoices: 1, minChoices: 1, skus: ['BOARD'], title: 'Board' },
					{
						description: '',
						maxChoices: 2,
						minChoices: 0,
						skus: ['RED', 'BLUE', 'GONE'],
						title: 'Keys',
					},
				],
			});
			const page = await bundles.page('starter');
			expect(page?.steps.map((s) => s.products.length)).toEqual([1, 3]);
			const [s1, s2] = page!.steps;

			const lines = await bundles.expand(id, [
				{ productIds: [board.id], stepId: s1.id },
				{ productIds: [red.id, blue.id], stepId: s2.id },
			]);
			expect([...lines]).toEqual([
				[board.id, 1],
				[red.id, 1],
				[blue.id, 1],
			]);

			await expect(bundles.expand(id, [{ productIds: [], stepId: s1.id }])).rejects.toThrow(
				'Board: choose 1.'
			);
			await expect(
				bundles.expand(id, [
					{ productIds: [board.id], stepId: s1.id },
					{ productIds: [gone.id], stepId: s2.id },
				])
			).rejects.toThrow('out of stock');
			await expect(bundles.expand(id, [{ productIds: [red.id], stepId: s1.id }])).rejects.toThrow(
				'not available'
			);

			const edit = await bundles.forEdit(id);
			expect(edit?.steps[1].skus).toEqual(['RED', 'BLUE', 'GONE']);
			await expect(
				bundles.save({ ...edit!, id, steps: [{ ...edit!.steps[0], skus: ['NOPE'] }] })
			).rejects.toThrow('Unknown SKU: NOPE');
			expect(await bundles.activeSlugs()).toContain('starter');
		});
	});

	describe('customer orders', () => {
		it('lists paid orders for the email, any case, newest first', async () => {
			const p = await product();
			const first = await order('paid', [p.id], 'Kim@Example.test');
			const second = await order('shipped', [p.id], 'kim@example.test');
			await order('paid', [p.id], 'someone@else.test');
			const list = await new CustomerService(db()).orders(' KIM@example.test ');
			expect(list.map((o) => o.number)).toEqual([second.number, first.number]);
			expect(list[0].path).toBe(`/order/${second.number}/${second.accessToken}`);
		});
	});
});
