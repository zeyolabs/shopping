import { SchemaForm } from '@zeyolabs/kit/utils/form';
import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

import { BUNDLE_STEP_ROLES } from '../db/schema';
import { FormInput } from '../utils/form-input';
import { ShopSchema } from '../utils/schemas';

/** What the customer picked: per step, the chosen product ids. */
export const BundleChoiceSchema = z.object({
	bundleId: Schema.Id,
	choices: z
		.array(
			z.object({
				/** A `fill` step repeats an id once per slot it takes. */
				productIds: z.array(Schema.Id).max(64),
				stepId: Schema.Id,
			})
		)
		.max(20),
});

export const BundleStepInputSchema = z
	.object({
		description: z.string().trim().max(500),
		maxChoices: z.number().int().min(1).max(30),
		/** A `fill` step: most slots one product may take; null for no limit. */
		maxPerChoice: z.number().int().min(1).max(64).nullable(),
		minChoices: z.number().int().min(0).max(30),
		role: z.enum(BUNDLE_STEP_ROLES),
		/** The products offered, by SKU, in display order; a `base` step's as `SKU=slots`. */
		skus: z.array(z.string().trim().min(1).max(60)).min(1, 'add at least one product').max(60),
		title: z.string().trim().min(1, 'name the step').max(120),
	})
	.refine((s) => s.minChoices <= s.maxChoices, 'minimum is above maximum');

/** The admin's bundle editor: the bundle and all its steps, saved together. */
export const BundleInputSchema = z.object({
	active: z.boolean(),
	description: z.string().trim().max(5000),
	/** Off the products' total when bought as this bundle; kits ignore it. */
	discountPercent: z.number().int().min(0).max(90),
	id: Schema.Id.optional(),
	image: z.string().trim().max(200).nullable(),
	name: z.string().trim().min(1, 'enter a name').max(200),
	slug: Schema.Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000),
	steps: z.array(BundleStepInputSchema).min(1, 'add at least one step').max(20),
});
export type BundleInput = z.infer<typeof BundleInputSchema>;

/**
 * The bundle editor's fields as the form sends them (SKUs as typed, one per line), turned into a
 * `BundleInput`. A blank slug is made from the name.
 */
export const BundleFormSchema = z
	.object({
		active: SchemaForm.Boolean,
		description: ShopSchema.FormText,
		discountPercent: SchemaForm.Int.default(0),
		id: Schema.Id.optional(),
		image: ShopSchema.FormText,
		name: ShopSchema.FormText,
		slug: ShopSchema.FormText,
		sortOrder: SchemaForm.Int,
		steps: z
			.array(
				z.object({
					description: ShopSchema.FormText,
					maxChoices: SchemaForm.Int,
					maxPerChoice: ShopSchema.FormText,
					minChoices: SchemaForm.Int,
					role: z.enum(BUNDLE_STEP_ROLES).default('pick'),
					skus: ShopSchema.FormText,
					title: ShopSchema.FormText,
				})
			)
			.default([]),
	})
	.transform((b) => ({
		...b,
		image: b.image.trim() || null,
		slug: b.slug.trim() || FormInput.slugify(b.name),
		steps: b.steps.map((step) => ({
			...step,
			maxPerChoice: Number(step.maxPerChoice) > 0 ? Number(step.maxPerChoice) : null,
			skus: step.skus
				.split(/[\s,]+/)
				.map((sku) => sku.trim())
				.filter(Boolean),
		})),
	}))
	.pipe(BundleInputSchema);
