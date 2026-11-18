import { Error400 } from '@zeyolabs/kit/utils/errors';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { BundleInput } from './schema';

import { CoverService } from '../catalogue/covers.server';
import { bundles, bundleStepProducts, bundleSteps, products } from '../db/schema';
import { StockService } from '../stock/service.server';
import { Batches } from '../utils/batches';
import { BundleSku } from './library';

type Choice = { productIds: number[]; stepId: number };

/** One product in a resolved bundle. `singleUnits`: `quantity` is single units (a kit's fill). */
export type BundlePart = {
	massGrams: number;
	name: string;
	pricePence: number;
	productId: number;
	quantity: number;
	singleUnits: boolean;
	sku: string;
};

export type ResolvedBundle = {
	bundle: { id: number; image: null | string; name: string; slug: string };
	/** What was chosen, one line each, for the basket and the order. */
	details: string[];
	/** True when the basket keeps it as one line (a kit, or a discounted bundle). */
	grouped: boolean;
	kit: boolean;
	/** The parts at their own prices, before any discount (a kit's free parts count 0). */
	listPricePence: number;
	massGrams: number;
	parts: BundlePart[];
	pricePence: number;
};

type Offered = {
	id: number;
	massGrams: number;
	name: string;
	packSize: number;
	pricePence: number;
	sku: string;
	units: number;
	variationLabel: null | string;
};

const Parts = {
	label: (p: Offered) => (p.variationLabel ? `${p.name} (${p.variationLabel})` : p.name),
	/** `units` single units of a product, weighing their share of a pack. */
	single: (p: Offered, units: number): BundlePart => ({
		massGrams: Math.round((p.massGrams * units) / Math.max(1, p.packSize)),
		name: Parts.label(p),
		pricePence: 0,
		productId: p.id,
		quantity: units,
		singleUnits: true,
		sku: p.sku,
	}),
};

/** Bundles built in steps. Data access and the rules for a valid choice; the basket does the rest. */
export class BundleService {
	constructor(private readonly db: ShopDb) {}

	/** Slugs of active bundles, for the sitemap. */
	async activeSlugs(): Promise<string[]> {
		const rows = await this.db
			.select({ slug: bundles.slug })
			.from(bundles)
			.where(eq(bundles.active, true));
		return rows.map((r) => r.slug);
	}

	/**
	 * Checks a plain bundle's choice and returns how many of each product to add to the basket as
	 * ordinary lines. Throws a 400 with a message the customer can act on.
	 */
	async expand(bundleId: number, choices: Choice[]): Promise<Map<number, number>> {
		const resolved = await this.resolve(bundleId, choices);
		const lines = new Map<number, number>();
		for (const part of resolved.parts) {
			lines.set(part.productId, (lines.get(part.productId) ?? 0) + part.quantity);
		}
		return lines;
	}

	/** One bundle for the admin editor, steps listing their products by SKU. */
	async forEdit(id: number) {
		const bundle = await this.db.query.bundles.findFirst({ where: eq(bundles.id, id) });
		if (!bundle) return undefined;
		const steps = await this.steps(id, { activeOnly: false });
		return {
			...bundle,
			steps: steps.map((s) => ({
				description: s.description,
				maxChoices: s.maxChoices,
				maxPerChoice: s.maxPerChoice,
				minChoices: s.minChoices,
				role: s.role,
				skus: s.products.map((p) =>
					BundleSku.format({ pricePence: p.kitPricePence, sku: p.sku, slots: p.slots })
				),
				title: s.title,
			})),
		};
	}

	/** Every bundle for the admin list. */
	async list() {
		return this.db.select().from(bundles).orderBy(asc(bundles.sortOrder), asc(bundles.name));
	}

	/** An active bundle with its steps and each step's active products (cover, price, sellable). */
	async page(slug: string) {
		const bundle = await this.db.query.bundles.findFirst({
			where: and(eq(bundles.slug, slug), eq(bundles.active, true)),
		});
		if (!bundle) return undefined;
		return { ...bundle, steps: await this.steps(bundle.id, { activeOnly: true }) };
	}

	/**
	 * Checks a customer's choice against the bundle's steps and prices it. A plain bundle's parts
	 * keep their own prices; a discounted bundle costs their total less its discount; a kit costs
	 * its base's price, its other parts are single units at no charge. `grouped` says whether the
	 * basket keeps it as one line. Throws a 400 with a message the customer can act on.
	 */
	async resolve(bundleId: number, choices: Choice[]): Promise<ResolvedBundle> {
		const bundle = await this.db.query.bundles.findFirst({
			where: and(eq(bundles.id, bundleId), eq(bundles.active, true)),
		});
		if (!bundle) throw Error400('This bundle is no longer available.');
		const steps = await this.steps(bundle.id, { activeOnly: true });
		const known = new Set(steps.map((s) => s.id));
		if (choices.some((c) => !known.has(c.stepId))) throw Error400('This bundle has changed.');
		const chosen = new Map(choices.map((c) => [c.stepId, c.productIds]));
		const kit = steps.some((s) => s.role === 'base');
		const parts: BundlePart[] = [];
		const details: string[] = [];
		let slots = 0;
		let kitPrice = 0;

		for (const step of steps) {
			const ids = chosen.get(step.id) ?? [];
			const offered = (id: number) => {
				const product = step.products.find((p) => p.id === id);
				if (!product) throw Error400(`${step.title}: that choice is not available.`);
				return product;
			};

			if (step.role === 'fill') {
				if (!slots) throw Error400(`${step.title}: choose a size first.`);
				if (ids.length !== slots) throw Error400(`${step.title}: fill all ${slots} slots.`);
				const counts = new Map<number, number>();
				for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
				for (const [id, units] of counts) {
					const product = offered(id);
					if (step.maxPerChoice && units > step.maxPerChoice) {
						throw Error400(`${step.title}: at most ${step.maxPerChoice} of ${product.name}.`);
					}
					if (product.units < units)
						throw Error400(`Only ${product.units} of ${product.name} left.`);
					parts.push(Parts.single(product, units));
					details.push(`${units} × ${Parts.label(product)}`);
				}
				continue;
			}

			const picks = [...new Set(ids)];
			const [min, max] =
				step.role === 'base' || step.role === 'cover' ? [1, 1] : [step.minChoices, step.maxChoices];
			if (picks.length < min || picks.length > max) {
				throw Error400(
					min === max ? `${step.title}: choose ${min}.` : `${step.title}: choose ${min} to ${max}.`
				);
			}
			for (const id of picks) {
				const product = offered(id);
				if (step.role === 'cover') {
					if (!slots) throw Error400(`${step.title}: choose a size first.`);
					if (product.units < slots)
						throw Error400(`Only ${product.units} of ${product.name} left.`);
					parts.push(Parts.single(product, slots));
					details.push(`${step.title}: ${Parts.label(product)}`);
					continue;
				}
				if (product.stock < 1) throw Error400(`${product.name} is out of stock.`);
				if (step.role === 'base') {
					if (!product.slots) throw Error400(`${step.title}: that choice is not available.`);
					slots = product.slots;
					kitPrice = product.kitPricePence ?? product.pricePence;
				}
				parts.push({
					...Parts.single(product, 1),
					massGrams: product.massGrams,
					pricePence:
						step.role === 'base'
							? (product.kitPricePence ?? product.pricePence)
							: product.pricePence,
					singleUnits: false,
				});
				details.push(
					step.role === 'base' ? Parts.label(product) : `${step.title}: ${Parts.label(product)}`
				);
			}
		}
		if (parts.length === 0) throw Error400('Choose at least one product.');

		const listPrice = parts.reduce((sum, p) => sum + p.pricePence * p.quantity, 0);
		const pricePence = kit
			? kitPrice
			: Math.round((listPrice * (100 - bundle.discountPercent)) / 100);
		return {
			bundle: { id: bundle.id, image: bundle.image, name: bundle.name, slug: bundle.slug },
			details,
			grouped: kit || bundle.discountPercent > 0,
			kit,
			listPricePence: listPrice,
			massGrams: parts.reduce((sum, p) => sum + p.massGrams, 0),
			parts: kit ? parts.map((p) => (p.singleUnits ? { ...p, pricePence: 0 } : p)) : parts,
			pricePence,
		};
	}

	/** Creates or replaces a bundle and all its steps. Unknown SKUs are a 400 naming them. */
	async save(input: BundleInput, now = Date.now()): Promise<number> {
		const skus = [
			...new Set(input.steps.flatMap((s) => s.skus.map((entry) => BundleSku.parse(entry).sku))),
		];
		const skuRows = await Batches.rows(skus, (slice) =>
			this.db
				.select({ id: products.id, sku: products.sku })
				.from(products)
				.where(inArray(products.sku, slice))
		);
		const found = new Map(skuRows.map((r) => [r.sku, r.id]));
		const missing = skus.filter((s) => !found.has(s));
		if (missing.length > 0) throw Error400(`Unknown SKU: ${missing.join(', ')}`);
		const clash = await this.db.query.bundles.findFirst({ where: eq(bundles.slug, input.slug) });
		if (clash && clash.id !== input.id) throw Error400('Another bundle already uses that slug.');

		const values = {
			active: input.active,
			description: input.description,
			discountPercent: input.discountPercent,
			image: input.image || null,
			name: input.name,
			slug: input.slug,
			sortOrder: input.sortOrder,
		};
		// A new bundle has no id until the batch inserts it, so later statements find it by slug,
		// and each step by its bundle and position.
		const bundleId =
			input.id ??
			sql<number>`(select ${bundles.id} from ${bundles} where ${bundles.slug} = ${input.slug})`;
		const stepId = (position: number) =>
			sql<number>`(select ${bundleSteps.id} from ${bundleSteps} where ${bundleSteps.bundleId} = ${bundleId} and ${bundleSteps.position} = ${position})`;
		const offered = input.steps.flatMap((step, position) => {
			const entries = new Map(
				step.skus.map((entry) => [BundleSku.parse(entry).sku, BundleSku.parse(entry)])
			);
			return [...entries.values()].map((entry, i) => ({
				position: i,
				pricePence: step.role === 'base' ? entry.pricePence : null,
				productId: found.get(entry.sku)!,
				slots: step.role === 'base' ? entry.slots : null,
				stepId: stepId(position),
			}));
		});

		// One atomic batch: the bundle and all its steps are saved, or nothing is. Steps are replaced
		// whole: simpler than diffing, and nothing else points at a step.
		await this.db.batch([
			input.id
				? this.db.update(bundles).set(values).where(eq(bundles.id, input.id))
				: this.db.insert(bundles).values({ ...values, createdAt: now }),
			this.db.delete(bundleSteps).where(eq(bundleSteps.bundleId, bundleId)),
			...input.steps.map((step, position) =>
				this.db.insert(bundleSteps).values({
					bundleId,
					description: step.description,
					maxChoices: step.maxChoices,
					maxPerChoice: step.role === 'fill' ? step.maxPerChoice : null,
					minChoices: step.minChoices,
					position,
					role: step.role,
					title: step.title,
				})
			),
			// Each row carries a subquery's parameters; 15 rows keep a statement under D1's 100.
			...Batches.chunks(offered, 15).map((rows) => this.db.insert(bundleStepProducts).values(rows)),
		]);
		if (input.id) return input.id;
		const [row] = await this.db
			.select({ id: bundles.id })
			.from(bundles)
			.where(eq(bundles.slug, input.slug));
		return row.id;
	}

	private async steps(bundleId: number, { activeOnly }: { activeOnly: boolean }) {
		const steps = await this.db
			.select()
			.from(bundleSteps)
			.where(eq(bundleSteps.bundleId, bundleId))
			.orderBy(asc(bundleSteps.position), asc(bundleSteps.id));
		if (steps.length === 0) return [];
		const offered = await this.db
			.select({
				active: products.active,
				id: products.id,
				kitPricePence: bundleStepProducts.pricePence,
				massGrams: products.massGrams,
				name: products.name,
				packSize: products.packSize,
				pricePence: products.pricePence,
				sku: products.sku,
				slots: bundleStepProducts.slots,
				slug: products.slug,
				stepId: bundleStepProducts.stepId,
				units: products.stock,
				variationLabel: products.variationLabel,
			})
			.from(bundleStepProducts)
			.innerJoin(products, eq(products.id, bundleStepProducts.productId))
			.where(
				and(
					inArray(
						bundleStepProducts.stepId,
						steps.map((s) => s.id)
					),
					activeOnly ? eq(products.active, true) : undefined
				)
			)
			.orderBy(asc(bundleStepProducts.position), asc(products.name));
		const ids = [...new Set(offered.map((p) => p.id))];
		const stock = new StockService(this.db);
		const sellable = await stock.availableMany(ids);
		const coverService = new CoverService(this.db);
		const covers = await coverService.covers(ids);
		return steps.map((step) => ({
			...step,
			products: offered
				.filter((p) => p.stepId === step.id)
				.map(({ stepId: _stepId, ...p }) => ({
					...p,
					cover: covers.get(p.id) ?? null,
					stock: sellable.get(p.id) ?? 0,
				})),
		}));
	}
}
