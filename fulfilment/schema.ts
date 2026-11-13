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

const Tracking = z
	.string()
	.transform((value) => value.replace(/\s+/g, '').toUpperCase())
	.pipe(
		z.union([
			z.literal(''),
			z.string().regex(/^[A-Z0-9]{8,20}$/, 'enter the tracking number, letters and digits only'),
		])
	);

/** Contact, address, postage service and tracking, as the admin corrects them on a paid or shipped order. */
export const OrderDetailsSchema = z.object({
	city: z.string().trim().min(1, 'enter the town or city').max(100),
	country: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/, 'enter the two-letter country code, e.g. GB'),
	email: z.string().trim().toLowerCase().pipe(z.email('enter a valid email')).max(254),
	line1: z.string().trim().min(1, 'enter the first address line').max(200),
	line2: z.string().trim().max(200).default(''),
	name: z.string().trim().min(1, 'enter the name').max(200),
	number: OrderNumber,
	phone: z.string().trim().max(40).default(''),
	postcode: z.string().trim().min(1, 'enter the postcode').max(20),
	shippingService: z.string().trim().max(50).default(''),
	trackingNumber: Tracking.default(''),
});
export type OrderDetails = z.infer<typeof OrderDetailsSchema>;
