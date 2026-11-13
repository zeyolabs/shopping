import { z } from 'zod';

/**
 * Zod pieces the shop's schemas share. Generic ones come from kit's `Schema` (`Schema.Slug`,
 * `Schema.Id`); these are the shop's own.
 */
export const ShopSchema = {
	/** A slug from a URL, for lookups. Not normalised: legacy slugs must match as they are. */
	SlugParam: z.string().min(1).max(200),

	/** A public order number, e.g. `PL-ABC234`. */
	OrderNumber: z.string().min(1).max(40),

	/** The secret in an order link (`/order/<number>/<token>`). */
	OrderToken: z.string().min(1).max(200),

	/** Integer pence, up to £100,000. */
	Pence: z.number().int().min(0).max(10_000_000),

	/** A text field a form may leave out: missing becomes ''. */
	FormText: z.string().default(''),
};
