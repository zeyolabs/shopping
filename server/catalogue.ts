import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import type { ShopDb } from '../db';

import {
	categories,
	productCategories,
	productImages,
	products,
	productSlugAliases,
} from '../db/schema';
import { BundleService } from './bundles';
import { StockService } from './stock-service';

export async function getCategory(db: ShopDb, slug: string) {
	return db.query.categories.findFirst({ where: eq(categories.slug, slug) });
}

export async function listCategories(db: ShopDb) {
	return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

type Product = typeof products.$inferSelect;

/** Adds each product's cover image (lowest position), if it has one. `stock` is what can be sold now. */
async function withCovers(db: ShopDb, list: Product[]) {
	if (list.length === 0) return [];
	const images = await db
		.select()
		.from(productImages)
		.where(
			inArray(
				productImages.productId,
				list.map((p) => p.id)
			)
		)
		.orderBy(asc(productImages.position));
	const cover = new Map<number, (typeof images)[number]>();
	for (const image of images) if (!cover.has(image.productId)) cover.set(image.productId, image);
	const sellable = await new StockService(db).availableMany(list.map((p) => p.id));
	return list.map((product) => ({
		...product,
		cover: cover.get(product.id),
		stock: sellable.get(product.id) ?? 0,
	}));
}

/** Active products in a category, each with its cover image, if any. */
export async function listCategoryProducts(db: ShopDb, categoryId: number) {
	const list = await db
		.select({ product: products })
		.from(productCategories)
		.innerJoin(products, eq(products.id, productCategories.productId))
		.where(and(eq(productCategories.categoryId, categoryId), eq(products.active, true)))
		.orderBy(asc(products.sortOrder), asc(products.name))
		.then((rows) => rows.map((r) => r.product));
	return withCovers(db, list);
}

/** Every active product, in stock first, each with its cover image. */
export async function listShopProducts(db: ShopDb) {
	const list = await db
		.select()
		.from(products)
		.where(eq(products.active, true))
		.orderBy(asc(products.sortOrder), asc(products.name));
	return withCovers(db, list);
}

/** Longest search the shop accepts, and how many results it returns. */
export const SEARCH_MAX_LENGTH = 100;
const SEARCH_LIMIT = 48;

/** `%` and `_` are wildcards in LIKE; a customer typing them means the characters. */
const likeEscape = (word: string) => word.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The words of a search, lower-cased, at most 6 (each must match). */
export function searchWords(query: string): string[] {
	return query
		.toLowerCase()
		.slice(0, SEARCH_MAX_LENGTH)
		.split(/\s+/)
		.filter((w) => w.length > 0)
		.slice(0, 6);
}

/**
 * Active products whose name, variation, SKU or descriptions contain every word of the query, name
 * matches first. A LIKE scan: fine for a shop's few hundred products, no index to keep in sync.
 */
export async function searchProducts(db: ShopDb, query: string) {
	const words = searchWords(query);
	if (words.length === 0) return [];
	const field = sql`lower(${products.name} || ' ' || coalesce(${products.variationLabel}, '') || ' ' || ${products.sku} || ' ' || ${products.shortDescription} || ' ' || ${products.description})`;
	const conditions = words.map((w) => sql`${field} like ${`%${likeEscape(w)}%`} escape '\\'`);
	const nameHit = sql<number>`lower(${products.name}) like ${`%${likeEscape(words[0])}%`} escape '\\'`;
	const list = await db
		.select()
		.from(products)
		.where(and(eq(products.active, true), ...conditions))
		.orderBy(desc(nameHit), asc(products.sortOrder), asc(products.name))
		.limit(SEARCH_LIMIT);
	return withCovers(db, list);
}

export async function getProduct(db: ShopDb, slug: string) {
	const product = await db.query.products.findFirst({
		where: and(eq(products.slug, slug), eq(products.active, true)),
		with: { images: { orderBy: asc(productImages.position) }, variationGroup: true },
	});
	if (!product) return undefined;
	product.stock = await new StockService(db).available(product.id);

	const options = product.variationGroupId
		? await db
				.select({ label: products.variationLabel, slug: products.slug })
				.from(products)
				.where(
					and(eq(products.variationGroupId, product.variationGroupId), eq(products.active, true))
				)
				.orderBy(asc(products.sortOrder), asc(products.name))
		: [];

	return { options, product, variationName: product.variationGroup?.name };
}

/** The current slug for a retired legacy slug, or for a legacy `?variant=` product code (the SKU). */
export async function findProductRedirect(
	db: ShopDb,
	input: { legacySlug: string; variantSku: null | string }
): Promise<string | undefined> {
	if (input.variantSku) {
		const variant = await db.query.products.findFirst({
			where: and(eq(products.sku, input.variantSku), eq(products.active, true)),
		});
		if (variant) return variant.slug;
	}
	const alias = await db.query.productSlugAliases.findFirst({
		where: eq(productSlugAliases.slug, input.legacySlug),
		with: { product: true },
	});
	return alias?.product.active ? alias.product.slug : undefined;
}

export async function listSitemapEntries(db: ShopDb) {
	const [cats, prods, bundleSlugs] = await Promise.all([
		db.select({ slug: categories.slug }).from(categories),
		db.select({ slug: products.slug }).from(products).where(eq(products.active, true)),
		new BundleService(db).activeSlugs(),
	]);
	return {
		bundles: bundleSlugs,
		categories: cats.map((c) => c.slug),
		products: prods.map((p) => p.slug),
	};
}
