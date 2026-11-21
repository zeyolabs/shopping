import { SchemaForm } from '@zeyolabs/kit/utils/form';
import { z } from 'zod';

import { PACKAGE_FORMATS } from '../db/schema';
import { FormInput } from '../utils/form-input';
import { BULK_DISPATCH_LIMIT, ORDER_FILTERS } from './filters';

/** The shop's own numbers (`KC-7F3K9Q`), or a number kept from an imported legacy shop. */
export const OrderNumber = z
	.string()
	.regex(/^(?:[A-Z]{2,5}-[A-Z0-9]{6}|[A-Z0-9]{8,20})$/, 'invalid order number');

export const OrderListSchema = z.object({
	filter: z.enum(ORDER_FILTERS).default('to-ship'),
	q: z.string().max(100).default(''),
});

/** Royal Mail tracking numbers are letters and digits (e.g. AB123456789GB); blank means untracked. */
export const ShipSchema = z.object({
	number: OrderNumber,
	/** Tick to dispatch without emailing the customer (e.g. the email already went another way). */
	skipEmail: SchemaForm.Boolean,
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

export const ORDER_STEPS = ['start', 'pack', 'hold', 'release'] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/** One form moves an order through packing: the order, and which button was pressed. */
export const OrderStepSchema = z.object({ number: OrderNumber, step: z.enum(ORDER_STEPS) });

/** Click & Drop takes parcels up to 30 kg. */
export const ParcelSchema = z.object({
	format: z.enum(PACKAGE_FORMATS),
	number: OrderNumber,
	weightGrams: z.number().int().min(1, 'enter the weight in grams').max(30_000),
});

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
	email: z.string().trim().toLowerCase().max(254).pipe(z.email('enter a valid email')),
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

/** Orders ticked on the list. Capped at `BULK_DISPATCH_LIMIT`. */
export const BulkDispatchSchema = z.object({
	numbers: z.array(OrderNumber).min(1).max(BULK_DISPATCH_LIMIT),
	sendEmail: z.boolean(),
});

/** Pounds as typed ("12.50"); the amount is refunded in full or in part, up to what is left. */
export const RefundSchema = z.object({
	amount: z
		.string()
		.trim()
		.refine((v) => {
			const pence = FormInput.parsePounds(v);
			return pence !== null && !Number.isNaN(pence) && pence > 0;
		}, 'enter an amount like 12.50')
		.transform((v) => FormInput.parsePounds(v) as number),
	number: OrderNumber,
});
