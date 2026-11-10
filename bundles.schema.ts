import { z } from 'zod';

const Slug = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case letters, digits and dashes');

/** What the customer picked: per step, the chosen product ids. */
export const BundleChoiceSchema = z.object({
	bundleId: z.number().int().positive(),
	choices: z
		.array(
			z.object({
				productIds: z.array(z.number().int().positive()).max(30),
				stepId: z.number().int().positive(),
			})
		)
		.max(20),
});

export const BundleStepInputSchema = z
	.object({
		description: z.string().trim().max(500).default(''),
		maxChoices: z.number().int().min(1).max(30),
		minChoices: z.number().int().min(0).max(30),
		/** The products offered, by SKU, in display order. */
		skus: z.array(z.string().trim().min(1).max(60)).min(1, 'add at least one product').max(60),
		title: z.string().trim().min(1, 'name the step').max(120),
	})
	.refine((s) => s.minChoices <= s.maxChoices, 'minimum is above maximum');

/** The admin's bundle editor: the bundle and all its steps, saved together. */
export const BundleInputSchema = z.object({
	active: z.boolean(),
	description: z.string().trim().max(5000).default(''),
	id: z.number().int().positive().optional(),
	image: z.string().trim().max(200).nullable().default(null),
	name: z.string().trim().min(1, 'enter a name').max(200),
	slug: Slug,
	sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
	steps: z.array(BundleStepInputSchema).min(1, 'add at least one step').max(20),
});
export type BundleInput = z.infer<typeof BundleInputSchema>;
