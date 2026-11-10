import { Error400 } from '@zeyolabs/kit/utils/errors';
import { and, asc, eq, inArray, like, ne, or, sql } from 'drizzle-orm';

import type { ShopDb } from '../db/index';
import type { CategoryInput, ProductInput } from './schema';

import {
	categories,
	productCategories,
	productComponents,
	productImages,
	products,
	productSlugAliases,
	variationGroups,
} from '../db/schema';
import { StockService } from '../stock/service.server';

/** The admin's catalogue editing: products, categories and variation groups. */
export class CatalogueAdminService {
	constructor(private readonly db: ShopDb) {}

	async categories() {
		return this.db
			.select({
				description: categories.description,
				id: categories.id,
				name: categories.name,
				products: sql<number>`(select count(*) from ${productCategories} where ${productCategories.categoryId} = ${categories.id})`,
				slug: categories.slug,
				sortOrder: categories.sortOrder,
			})
			.from(categories)
			.orderBy(asc(categories.sortOrder), asc(categories.name));
	}

	/** One product as the editor needs it, or undefined. */
	async productForEdit(id: number) {
		const db = this.db;
		const product = await db.query.products.findFirst({ where: eq(products.id, id) });
		if (!product) return undefined;
		const [cats, images, components, group] = await Promise.all([
			db
				.select({ id: productCategories.categoryId })
				.from(productCategories)
				.where(eq(productCategories.productId, id)),
			db
				.select({ alt: productImages.alt, src: productImages.src })
				.from(productImages)
				.where(eq(productImages.productId, id))
				.orderBy(asc(productImages.position)),
			db
				.select({ quantity: productComponents.quantity, sku: products.sku })
				.from(productComponents)
				.innerJoin(products, eq(products.id, productComponents.componentId))
				.where(eq(productComponents.productId, id)),
			product.variationGroupId
				? db.query.variationGroups.findFirst({
						where: eq(variationGroups.id, product.variationGroupId),
					})
				: undefined,
		]);
		return {
			...product,
			categoryIds: cats.map((c) => c.id),
			components,
			images,
			variationGroup: group?.name ?? null,
		};
	}

	/** Every product for the admin list, optionally filtered by name or SKU. */
	async products(q = '') {
		const term = q
			.trim()
			.toLowerCase()
			.replace(/[\\%_]/g, (c) => `\\${c}`);
		return this.db
			.select({
				active: products.active,
				id: products.id,
				name: products.name,
				pricePence: products.pricePence,
				sku: products.sku,
				slug: products.slug,
				stock: products.stock,
				variationLabel: products.variationLabel,
			})
			.from(products)
			.where(
				term
					? or(
							like(sql`lower(${products.name})`, `%${term}%`),
							like(sql`lower(${products.sku})`, `%${term}%`)
						)
					: undefined
			)
			.orderBy(asc(products.sortOrder), asc(products.name), asc(products.id))
			.limit(500);
	}

	async saveCategory(input: CategoryInput): Promise<number> {
		const db = this.db;
		const clash = await db.query.categories.findFirst({ where: eq(categories.slug, input.slug) });
		if (clash && clash.id !== input.id) throw Error400('Another category already uses that slug.');
		const { id, ...values } = input;
		if (id === undefined) {
			const [row] = await db.insert(categories).values(values).returning({ id: categories.id });
			return row.id;
		}
		await db.update(categories).set(values).where(eq(categories.id, id));
		return id;
	}

	/**
	 * Creates or updates a product with its categories, images and components. Changing the slug keeps
	 * the old one as an alias, so existing links 301 to the new URL. Stock is left alone: new products
	 * start at 0 and stock changes go through the stock page.
	 */
	async saveProduct(input: ProductInput, now = Date.now()): Promise<number> {
		const db = this.db;
		const [slugClash, skuClash, aliasClash] = await Promise.all([
			db.query.products.findFirst({
				where: and(eq(products.slug, input.slug), input.id ? ne(products.id, input.id) : undefined),
			}),
			db.query.products.findFirst({
				where: and(eq(products.sku, input.sku), input.id ? ne(products.id, input.id) : undefined),
			}),
			db.query.productSlugAliases.findFirst({ where: eq(productSlugAliases.slug, input.slug) }),
		]);
		if (slugClash) throw Error400('Another product already uses that slug.');
		if (skuClash) throw Error400('Another product already uses that SKU.');
		if (aliasClash && aliasClash.productId !== input.id) {
			throw Error400('That slug is an old link of another product.');
		}
		if (input.categoryIds.length > 0) {
			const known = await db
				.select({ id: categories.id })
				.from(categories)
				.where(inArray(categories.id, input.categoryIds));
			if (known.length !== new Set(input.categoryIds).size) throw Error400('Unknown category.');
		}
		const componentSkus = input.components.map((c) => c.sku);
		const componentRows = componentSkus.length
			? await db
					.select({ id: products.id, sku: products.sku })
					.from(products)
					.where(inArray(products.sku, componentSkus))
			: [];
		const componentId = new Map(componentRows.map((r) => [r.sku, r.id]));
		const missing = componentSkus.filter((s) => !componentId.has(s));
		if (missing.length > 0) throw Error400(`Unknown component SKU: ${missing.join(', ')}`);

		const values = {
			active: input.active,
			comparePricePence: input.comparePricePence,
			description: input.description,
			lowStockThreshold: input.lowStockThreshold,
			massGrams: input.massGrams,
			maxPerOrder: input.maxPerOrder,
			name: input.name,
			packSize: input.packSize,
			pricePence: input.pricePence,
			shortDescription: input.shortDescription,
			sku: input.sku,
			slug: input.slug,
			sortOrder: input.sortOrder,
			variationGroupId: await this.variationGroupId(input.variationGroup),
			variationLabel: input.variationGroup ? input.variationLabel || null : null,
		};

		let id = input.id;
		if (id === undefined) {
			const [row] = await db
				.insert(products)
				.values({ ...values, createdAt: now, stock: 0 })
				.returning({ id: products.id });
			id = row.id;
		} else {
			const before = await db.query.products.findFirst({ where: eq(products.id, id) });
			if (!before) throw Error400('Product not found.');
			await db.update(products).set(values).where(eq(products.id, id));
			if (before.slug !== input.slug) {
				await db
					.insert(productSlugAliases)
					.values({ productId: id, slug: before.slug })
					.onConflictDoNothing();
			}
		}
		const productId = id;
		// The new slug is the product's own now, not an alias of it.
		await db
			.delete(productSlugAliases)
			.where(
				and(eq(productSlugAliases.slug, input.slug), eq(productSlugAliases.productId, productId))
			);

		await db.batch([
			db.delete(productCategories).where(eq(productCategories.productId, productId)),
			db.delete(productImages).where(eq(productImages.productId, productId)),
			...[...new Set(input.categoryIds)].map((categoryId) =>
				db.insert(productCategories).values({ categoryId, productId })
			),
			...input.images.map((image, position) =>
				db.insert(productImages).values({ alt: image.alt, position, productId, src: image.src })
			),
		]);
		const stock = new StockService(db);
		await stock.setComponents(
			productId,
			input.components.map((c) => ({ componentId: componentId.get(c.sku)!, quantity: c.quantity }))
		);
		return productId;
	}

	/** Names of the existing variation groups, for the editor's suggestions. */
	async variationGroups() {
		return this.db.select().from(variationGroups).orderBy(asc(variationGroups.name));
	}

	private async variationGroupId(name: null | string): Promise<null | number> {
		if (!name) return null;
		const db = this.db;
		const found = await db.query.variationGroups.findFirst({
			where: eq(variationGroups.name, name),
		});
		if (found) return found.id;
		const [row] = await db.insert(variationGroups).values({ name }).returning();
		return row.id;
	}
}
