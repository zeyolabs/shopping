import { describe, expect, it } from 'vitest';

import { shopTestDb } from '../__fixtures__/db';
import { BundleService } from './service.server';

describe('BundleService', () => {
	const { db, product } = shopTestDb();

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

	it('saves a step offering more products than one statement can hold', async () => {
		const skus: string[] = [];
		for (let i = 0; i < 40; i++) skus.push((await product({ sku: `MANY${i}` })).sku);
		const bundles = new BundleService(db());
		const step = { description: '', maxChoices: 3, minChoices: 1, skus, title: 'Pick' };
		const base = {
			active: true,
			description: '',
			image: null,
			name: 'Big',
			slug: 'big',
			sortOrder: 0,
		};
		const id = await bundles.save({ ...base, steps: [step] });
		expect((await bundles.forEdit(id))?.steps[0].skus).toEqual(skus);
		// Saving again replaces the steps rather than adding to them.
		await bundles.save({ ...base, id, steps: [step, { ...step, title: 'Again' }] });
		expect((await bundles.forEdit(id))?.steps.map((s) => s.skus.length)).toEqual([40, 40]);
	});
});
