import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

import { ShopSchema } from '../utils/schemas';

/** A verified buyer's review, sent from their order page (the token proves the purchase). */
export const ReviewSchema = z.object({
	body: z.string().trim().min(10, 'write at least a sentence').max(2000),
	name: z.string().trim().min(1, 'enter the name to show').max(60),
	number: ShopSchema.OrderNumber,
	productId: Schema.Id,
	rating: z.number().int().min(1, 'choose 1 to 5 stars').max(5, 'choose 1 to 5 stars'),
	title: z.string().trim().max(100).default(''),
	token: ShopSchema.OrderToken,
});

/** Staff approving or rejecting a review in the admin. */
export const ModerateReviewSchema = z.object({
	id: Schema.Id,
	status: z.enum(['approved', 'rejected']),
});
