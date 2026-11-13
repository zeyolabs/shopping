import { Schema } from '@zeyolabs/kit/utils/schema';
import { z } from 'zod';

export const StockSchema = z.object({
	productId: Schema.Id,
	stock: z.number().int().min(0, 'stock cannot be negative').max(100_000),
});
