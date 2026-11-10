import { z } from 'zod';

/** A verified buyer's review, sent from their order page (the token proves the purchase). */
export const ReviewSchema = z.object({
	body: z.string().trim().min(10, 'write at least a sentence').max(2000),
	name: z.string().trim().min(1, 'enter the name to show').max(60),
	number: z.string().min(1).max(40),
	productId: z.number().int().positive(),
	rating: z.number().int().min(1, 'choose 1 to 5 stars').max(5, 'choose 1 to 5 stars'),
	title: z.string().trim().max(100).default(''),
	token: z.string().min(1).max(200),
});

/** Staff approving or rejecting a review in the admin. */
export const ModerateReviewSchema = z.object({
	id: z.number().int().positive(),
	status: z.enum(['approved', 'rejected']),
});
