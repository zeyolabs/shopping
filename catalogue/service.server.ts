import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';

import { BundleService } from '../bundles/service.server';
import {
	categories,
	productCategories,
	productImages,
	products,
	productSlugAliases,
} from '../db/schema';
import { StockService } from '../stock/service.server';
import { CoverService } from './covers.server';
import { Search } from './library';

type Product = typeof products.$inferSelect;

/** The public catalogue: categories, products, search, old-URL redirects and the sitemap. */
export class CatalogueService {
	constructor(private readonly db: ShopDb) {}

	async categories() {
		return this.db
			.select()
			.from(categories)
			.orderBy(asc(categories.sortOrder), asc(categories.name));
	}

	async category(slug: string) {
		return this.db.query.categories.findFirst({ where: eq(categories.slug, slug) });
	}

	/** Active products in a category, each with its cover image, if any. */
	async categoryProducts(categoryId: number) {
		const list = await this.db
			.select({ product: products })
			.from(productCategories)
			.innerJoin(products, eq(products.id, productCategories.productId))
			.where(and(eq(productCategories.categoryId, categoryId), eq(products.active, true)))
			.orderBy(asc(products.sortOrder), asc(products.name))
			.then((rows) => rows.map((r) => r.product));
		return this.withCovers(list);
	}

	/** An active product with its images and the other options in its variation group. */
	async product(slug: string) {
		const product = await this.db.query.products.findFirst({
			where: and(eq(products.slug, slug), eq(products.active, true)),
			with: { images: { orderBy: asc(productImages.position) }, variationGroup: true },
		});
		if (!product) return undefined;
		const stock = new StockService(this.db);
		product.stock = await stock.available(product.id);

		const options = product.variationGroupId
			? await this.db
					.select({ label: products.variationLabel, slug: products.slug })
					.from(products)
					.where(
						and(eq(products.variationGroupId, product.variationGroupId), eq(products.active, true))
					)
					.orderBy(asc(products.sortOrder), asc(products.name))
			: [];

		return { options, product, variationName: product.variationGroup?.name };
	}

	/** Every active product, each with its cover image. */
	async products() {
		const list = await this.db
			.select()
			.from(products)
			.where(eq(products.active, true))
			.orderBy(asc(products.sortOrder), asc(products.name));
		return this.withCovers(list);
	}

	/** The current slug for a retired legacy slug, or for a legacy `?variant=` product code (the SKU). */
	async redirect(input: { legacySlug: string; variantSku: null | string }) {
		if (input.variantSku) {
			const variant = await this.db.query.products.findFirst({
				where: and(eq(products.sku, input.variantSku), eq(products.active, true)),
			});
			if (variant) return variant.slug;
		}
		const alias = await this.db.query.productSlugAliases.findFirst({
			where: eq(productSlugAliases.slug, input.legacySlug),
			with: { product: true },
		});
		return alias?.product.active ? alias.product.slug : undefined;
	}

	/**
	 * Active products whose name, variation, SKU or descriptions contain every word of the query,
	 * name matches first. A LIKE scan: fine for a shop's few hundred products, no index to keep.
	 */
	async search(query: string) {
		const words = Search.words(query);
		if (words.length === 0) return [];
		const field = sql`lower(${products.name} || ' ' || coalesce(${products.variationLabel}, '') || ' ' || ${products.sku} || ' ' || ${products.shortDescription} || ' ' || ${products.description})`;
		const conditions = words.map((w) => sql`${field} like ${Search.pattern(w)} escape '\\'`);
		const nameHit = sql<number>`lower(${products.name}) like ${Search.pattern(words[0])} escape '\\'`;
		const list = await this.db
			.select()
			.from(products)
			.where(and(eq(products.active, true), ...conditions))
			.orderBy(desc(nameHit), asc(products.sortOrder), asc(products.name))
			.limit(Search.LIMIT);
		return this.withCovers(list);
	}

	/** Slugs for the sitemap: categories, active products and active bundles. */
	async sitemapEntries() {
		const bundles = new BundleService(this.db);
		const [cats, prods, bundleSlugs] = await Promise.all([
			this.db.select({ slug: categories.slug }).from(categories),
			this.db.select({ slug: products.slug }).from(products).where(eq(products.active, true)),
			bundles.activeSlugs(),
		]);
		return {
			bundles: bundleSlugs,
			categories: cats.map((c) => c.slug),
			products: prods.map((p) => p.slug),
		};
	}

	/** Adds each product's cover image (lowest position). `stock` becomes what can be sold now. */
	private async withCovers(list: Product[]) {
		if (list.length === 0) return [];
		const ids = list.map((p) => p.id);
		const covers = new CoverService(this.db);
		const stock = new StockService(this.db);
		const [cover, sellable] = await Promise.all([covers.covers(ids), stock.availableMany(ids)]);
		return list.map((product) => ({
			...product,
			cover: cover.get(product.id),
			stock: sellable.get(product.id) ?? 0,
		}));
	}
}
