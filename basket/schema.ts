import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

/** "Add to basket" on a product page. */
export const AddToBasketSchema = z.object({
	productId: Schema.Id,
	quantity: z.number().int().min(1).max(99).default(1),
});

/** The basket's − and + buttons: each submits the line's new quantity; 0 removes the line. */
export const BasketQuantitySchema = z.object({
	productId: Schema.Id,
	quantity: z.number().int().min(0).max(99),
});
