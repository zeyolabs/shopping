import { z } from 'zod';

const Slug = z
	.string()
	.trim()
	.min(1, 'enter a slug')
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case letters, digits and dashes');

const Pence = z.number().int().min(0).max(10_000_000);

/** The admin's product editor. Stock is not here: it changes only through the stock page. */
export const ProductInputSchema = z.object({
	active: z.boolean(),
	categoryIds: z.array(z.number().int().positive()).max(50),
	comparePricePence: Pence.nullable(),
	/** Combined products: the parts by SKU. Empty for a normal product. */
	components: z
		.array(z.object({ quantity: z.number().int().min(1).max(1000), sku: z.string().trim().min(1) }))
		.max(10),
	description: z.string().max(20_000),
	id: z.number().int().positive().optional(),
	/** File names in the image bucket, cover first. */
	images: z
		.array(z.object({ alt: z.string().trim().max(200), src: z.string().trim().min(1).max(200) }))
		.max(20),
	lowStockThreshold: z.number().int().min(0).max(10_000).nullable(),
	massGrams: z.number().int().min(0).max(100_000),
	maxPerOrder: z.number().int().min(1).max(99),
	name: z.string().trim().min(1, 'enter a name').max(200),
	packSize: z.number().int().min(1).max(10_000),
	pricePence: Pence,
	shortDescription: z.string().trim().max(500),
	sku: z
		.string()
		.trim()
		.min(1, 'enter a SKU')
		.max(60)
		.regex(/^[A-Za-z0-9._-]+$/, 'letters, digits, dots, dashes and underscores'),
	slug: Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000),
	/** Name of the variation group (created if new), or null. */
	variationGroup: z.string().trim().max(100).nullable(),
	variationLabel: z.string().trim().max(100).nullable(),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const CategoryInputSchema = z.object({
	description: z.string().trim().max(5000),
	id: z.number().int().positive().optional(),
	name: z.string().trim().min(1, 'enter a name').max(200),
	slug: Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000),
});
export type CategoryInput = z.infer<typeof CategoryInputSchema>;
