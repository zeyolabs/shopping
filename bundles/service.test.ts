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
			discountPercent: 0,
			image: null,
			name: 'Starter',
			slug: 'starter',
			sortOrder: 0,
			steps: [
				{
					description: '',
					maxChoices: 1,
					maxPerChoice: null,
					minChoices: 1,
					role: 'pick' as const,
					skus: ['BOARD'],
					title: 'Board',
				},
				{
					description: '',
					maxChoices: 2,
					maxPerChoice: null,
					minChoices: 0,
					role: 'pick' as const,
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
		const step = {
			description: '',
			maxChoices: 3,
			maxPerChoice: null,
			minChoices: 1,
			role: 'pick' as const,
			skus,
			title: 'Pick',
		};
		const base = {
			active: true,
			description: '',
			discountPercent: 0,
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

describe('BundleService kits and discounts', () => {
	const { db, product } = shopTestDb();
	const step = (
		title: string,
		skus: string[],
		extra: Partial<{
			maxChoices: number;
			maxPerChoice: null | number;
			minChoices: number;
			role: 'base' | 'cover' | 'fill' | 'pick';
		}> = {}
	) => ({
		description: '',
		maxChoices: 1,
		maxPerChoice: null,
		minChoices: 1,
		role: 'pick' as const,
		skus,
		title,
		...extra,
	});
	const bundle = { active: true, description: '', image: null, sortOrder: 0 };

	it('prices a kit at its base, takes single units for the slots and checks every rule', async () => {
		const base = await product({ massGrams: 50, pricePence: 950, sku: 'BASE4' });
		const pom = await product({
			massGrams: 20,
			packSize: 10,
			pricePence: 450,
			sku: 'POM',
			stock: 30,
		});
		const ink = await product({
			massGrams: 20,
			packSize: 10,
			pricePence: 550,
			sku: 'INK',
			stock: 2,
		});
		const caps = await product({
			massGrams: 10,
			packSize: 10,
			pricePence: 1,
			sku: 'CAPS',
			stock: 40,
		});
		const bundles = new BundleService(db());
		const id = await bundles.save({
			...bundle,
			discountPercent: 10,
			name: 'Tester',
			slug: 'tester',
			steps: [
				step('Size', ['BASE4=4'], { role: 'base' }),
				step('Switches', ['POM', 'INK'], { maxPerChoice: 3, role: 'fill' }),
				step('Keycaps', ['CAPS'], { role: 'cover' }),
			],
		});
		const [size, fill, cover] = (await bundles.page('tester'))!.steps;
		const choose = (switches: number[]) =>
			bundles.resolve(id, [
				{ productIds: [base.id], stepId: size.id },
				{ productIds: switches, stepId: fill.id },
				{ productIds: [caps.id], stepId: cover.id },
			]);

		const kit = await choose([pom.id, pom.id, pom.id, ink.id]);
		expect(kit).toMatchObject({ grouped: true, kit: true, pricePence: 950 });
		expect(kit.parts.map((p) => [p.sku, p.quantity, p.singleUnits, p.pricePence])).toEqual([
			['BASE4', 1, false, 950],
			['POM', 3, true, 0],
			['INK', 1, true, 0],
			['CAPS', 4, true, 0],
		]);
		expect(kit.massGrams).toBe(50 + 6 + 2 + 4);

		await expect(choose([pom.id, pom.id, ink.id])).rejects.toThrow('fill all 4 slots');
		await expect(choose([pom.id, pom.id, pom.id, pom.id])).rejects.toThrow('at most 3');
		await expect(choose([pom.id, ink.id, ink.id, ink.id])).rejects.toThrow('Only 2 of');
	});

	it('takes the discount off a bundle of whole products', async () => {
		const a = await product({ pricePence: 1000, sku: 'LUBE' });
		const b = await product({ pricePence: 500, sku: 'BRUSH' });
		const bundles = new BundleService(db());
		const id = await bundles.save({
			...bundle,
			discountPercent: 10,
			name: 'Lube kit',
			slug: 'lube-kit',
			steps: [step('Lube', ['LUBE']), step('Brush', ['BRUSH'], { minChoices: 0 })],
		});
		const [s1, s2] = (await bundles.page('lube-kit'))!.steps;
		const resolved = await bundles.resolve(id, [
			{ productIds: [a.id], stepId: s1.id },
			{ productIds: [b.id], stepId: s2.id },
		]);
		expect(resolved).toMatchObject({
			grouped: true,
			kit: false,
			listPricePence: 1500,
			pricePence: 1350,
		});
		expect(resolved.parts.every((p) => !p.singleUnits)).toBe(true);
	});
});
