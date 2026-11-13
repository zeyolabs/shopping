import { Error400 } from '@zeyolabs/kit/utils/errors';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { BundleInput } from './schema';

import { CoverService } from '../catalogue/covers.server';
import { bundles, bundleStepProducts, bundleSteps, products } from '../db/schema';
import { StockService } from '../stock/service.server';
import { Batches } from '../utils/batches';

type Choice = { productIds: number[]; stepId: number };

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
	 * Checks a customer's choice against the bundle's steps and returns how many of each product to
	 * add to the basket. Throws a 400 with a message the customer can act on.
	 */
	async expand(bundleId: number, choices: Choice[]): Promise<Map<number, number>> {
		const bundle = await this.db.query.bundles.findFirst({
			where: and(eq(bundles.id, bundleId), eq(bundles.active, true)),
		});
		if (!bundle) throw Error400('This bundle is no longer available.');
		const steps = await this.steps(bundle.id, { activeOnly: true });
		const chosen = new Map(choices.map((c) => [c.stepId, [...new Set(c.productIds)]]));
		const lines = new Map<number, number>();
		for (const step of steps) {
			const picks = chosen.get(step.id) ?? [];
			if (picks.length < step.minChoices || picks.length > step.maxChoices) {
				throw Error400(
					step.minChoices === step.maxChoices
						? `${step.title}: choose ${step.minChoices}.`
						: `${step.title}: choose ${step.minChoices} to ${step.maxChoices}.`
				);
			}
			for (const id of picks) {
				const product = step.products.find((p) => p.id === id);
				if (!product) throw Error400(`${step.title}: that choice is not available.`);
				if (product.stock < 1) throw Error400(`${product.name} is out of stock.`);
				lines.set(id, (lines.get(id) ?? 0) + 1);
			}
		}
		const known = new Set(steps.map((s) => s.id));
		if (choices.some((c) => !known.has(c.stepId))) throw Error400('This bundle has changed.');
		if (lines.size === 0) throw Error400('Choose at least one product.');
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
				minChoices: s.minChoices,
				skus: s.products.map((p) => p.sku),
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

	/** Creates or replaces a bundle and all its steps. Unknown SKUs are a 400 naming them. */
	async save(input: BundleInput, now = Date.now()): Promise<number> {
		const skus = [...new Set(input.steps.flatMap((s) => s.skus))];
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
		const offered = input.steps.flatMap((step, position) =>
			[...new Set(step.skus)].map((sku, i) => ({
				position: i,
				productId: found.get(sku)!,
				stepId: stepId(position),
			}))
		);

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
					minChoices: step.minChoices,
					position,
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
				name: products.name,
				pricePence: products.pricePence,
				sku: products.sku,
				slug: products.slug,
				stepId: bundleStepProducts.stepId,
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
