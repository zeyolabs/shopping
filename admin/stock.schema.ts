import { z } from 'zod';

export const StockSchema = z.object({
	productId: z.number().int().positive(),
	stock: z.number().int().min(0, 'stock cannot be negative').max(100_000),
});
