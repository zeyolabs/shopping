import { SchemaForm } from '@zeyolabs/kit/utils/form';
import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

import { FormInput } from '../utils/form-input';
import { ShopSchema } from '../utils/schemas';

/** The admin's product editor. Stock is not here: it changes only through the stock page. */
export const ProductInputSchema = z.object({
	active: z.boolean(),
	categoryIds: z.array(Schema.Id).max(50),
	comparePricePence: ShopSchema.Pence.nullable(),
	/** Combined products: the parts by SKU. Empty for a normal product. */
	components: z
		.array(z.object({ quantity: z.number().int().min(1).max(1000), sku: z.string().trim().min(1) }))
		.max(10),
	description: z.string().max(20_000),
	id: Schema.Id.optional(),
	/** File names in the image bucket, cover first. */
	images: z
		.array(z.object({ alt: z.string().trim().max(200), src: z.string().trim().min(1).max(200) }))
		.max(20),
	lowStockThreshold: z.number().int().min(0).max(10_000).nullable(),
	massGrams: z.number().int().min(0).max(100_000),
	maxPerOrder: z.number().int().min(1).max(99),
	name: z.string().trim().min(1, 'enter a name').max(200),
	packSize: z.number().int().min(1).max(10_000),
	pricePence: ShopSchema.Pence,
	shortDescription: z.string().trim().max(500),
	sku: z
		.string()
		.trim()
		.min(1, 'enter a SKU')
		.max(60)
		.regex(/^[A-Za-z0-9._-]+$/, 'letters, digits, dots, dashes and underscores'),
	slug: Schema.Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000),
	/** Name of the variation group (created if new), or null. */
	variationGroup: z.string().trim().max(100).nullable(),
	variationLabel: z.string().trim().max(100).nullable(),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const CategoryInputSchema = z.object({
	description: z.string().trim().max(5000),
	id: Schema.Id.optional(),
	name: z.string().trim().min(1, 'enter a name').max(200),
	slug: Schema.Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000),
});
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

/** Pounds as typed ("12.50", "£12.5"); blank is allowed only where `optional`. */
function pounds(optional: boolean) {
	return z
		.string()
		.trim()
		.default('')
		.refine((v) => (v === '' ? optional : !Number.isNaN(FormInput.parsePounds(v))), {
			message: optional
				? 'enter a price like 15.00, or leave it blank'
				: 'enter a price like 12.50',
		})
		.transform((v) => FormInput.parsePounds(v));
}

/**
 * The product editor's fields as the form sends them (prices in pounds, category ids as strings,
 * blank rows allowed), turned into a `ProductInput`. A blank slug is made from the name.
 */
export const ProductFormSchema = z
	.object({
		active: SchemaForm.Boolean,
		categoryIds: z.array(z.string().regex(/^\d+$/)).default([]),
		comparePrice: pounds(true),
		components: z
			.array(z.object({ quantity: SchemaForm.nullable(SchemaForm.Int), sku: ShopSchema.FormText }))
			.default([]),
		description: ShopSchema.FormText,
		id: Schema.Id.optional(),
		images: z.array(z.object({ alt: ShopSchema.FormText, src: ShopSchema.FormText })).default([]),
		lowStockThreshold: SchemaForm.nullable(SchemaForm.Int),
		massGrams: SchemaForm.Int,
		maxPerOrder: SchemaForm.Int,
		name: ShopSchema.FormText,
		packSize: SchemaForm.Int,
		price: pounds(false),
		shortDescription: ShopSchema.FormText,
		sku: ShopSchema.FormText,
		slug: ShopSchema.FormText,
		sortOrder: SchemaForm.Int,
		variationGroup: ShopSchema.FormText,
		variationLabel: ShopSchema.FormText,
	})
	.transform(({ categoryIds, comparePrice, components, images, price, ...p }) => ({
		...p,
		categoryIds: categoryIds.map(Number),
		comparePricePence: comparePrice,
		components: components
			.filter((c) => c.sku.trim() !== '')
			.map((c) => ({ quantity: c.quantity ?? 1, sku: c.sku })),
		images: images.filter((i) => i.src.trim() !== ''),
		pricePence: price ?? 0,
		slug: p.slug.trim() || FormInput.slugify(p.name),
		variationGroup: p.variationGroup.trim() || null,
		variationLabel: p.variationLabel.trim() || null,
	}))
	.pipe(ProductInputSchema);

/** The category editor's fields; a blank slug is made from the name. */
export const CategoryFormSchema = z
	.object({
		description: ShopSchema.FormText,
		id: Schema.Id.optional(),
		name: ShopSchema.FormText,
		slug: ShopSchema.FormText,
		sortOrder: SchemaForm.Int,
	})
	.transform((c) => ({ ...c, slug: c.slug.trim() || FormInput.slugify(c.name) }))
	.pipe(CategoryInputSchema);
