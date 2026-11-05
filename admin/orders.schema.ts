import { z } from 'zod';

import { PACKAGE_FORMATS } from '../db/schema';
import { ORDER_FILTERS } from './filters';

export const OrderListSchema = z.object({
	filter: z.enum(ORDER_FILTERS).default('to-ship'),
	q: z.string().max(100).default(''),
});

/** Royal Mail tracking numbers are letters and digits (e.g. AB123456789GB); blank means untracked. */
export const ShipSchema = z.object({
	number: z.string().regex(/^[A-Z]{2,5}-[A-Z0-9]{6}$/, 'invalid order number'),
	trackingNumber: z
		.string()
		.transform((value) => value.replace(/\s+/g, '').toUpperCase())
		.pipe(
			z.union([
				z.literal(''),
				z.string().regex(/^[A-Z0-9]{8,20}$/, 'enter the tracking number, letters and digits only'),
			])
		),
});

export const OrderNumber = z.string().regex(/^[A-Z]{2,5}-[A-Z0-9]{6}$/, 'invalid order number');

export const ORDER_STEPS = ['start', 'pack', 'hold', 'release'] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/** One form moves an order through packing: the order, and which button was pressed. */
export const OrderStepSchema = z.object({ number: OrderNumber, step: z.enum(ORDER_STEPS) });

const Millimetres = z.number().int().min(1).max(1000);

/** Click & Drop takes parcels up to 30 kg. The three measurements go together or not at all. */
export const ParcelSchema = z
	.object({
		format: z.enum(PACKAGE_FORMATS),
		heightMm: Millimetres.optional(),
		lengthMm: Millimetres.optional(),
		number: OrderNumber,
		weightGrams: z.number().int().min(1, 'enter the weight in grams').max(30_000),
		widthMm: Millimetres.optional(),
	})
	.refine(
		({ heightMm, lengthMm, widthMm }) =>
			[heightMm, lengthMm, widthMm].every((v) => v === undefined) ||
			[heightMm, lengthMm, widthMm].every((v) => v !== undefined),
		{ message: 'give length, width and height, or leave all three blank', path: ['lengthMm'] }
	);
