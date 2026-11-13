import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { FormResult } from '@zeyolabs/kit/utils/form';

import { FulfilmentManager } from './manager.server';
import {
	OrderDetailsSchema,
	OrderListSchema,
	OrderNumber,
	OrderStepSchema,
	ParcelSchema,
	ShipSchema,
} from './schema';

export const getOrders = Remote.Query(OrderListSchema, ({ filter, q }) =>
	FulfilmentManager.list(filter, q)
);

export const getOrderCounts = Remote.Query(() => FulfilmentManager.counts());

export const getOrder = Remote.Query(OrderNumber, (number) => FulfilmentManager.find(number));

export const shipForm = Remote.Form(ShipSchema, async ({ number, trackingNumber }) => {
	const { emailed } = await FulfilmentManager.markShipped(number, trackingNumber || null);
	await Promise.all([getOrder(number).refresh(), getOrderCounts().refresh()]);
	return emailed
		? FormResult.ok('Marked as dispatched and the customer has been emailed.')
		: FormResult.warn(
				'Marked as dispatched, but the email failed to send. Submit again to retry it.'
			);
});

const STEP_MESSAGES = {
	hold: 'Order put on hold.',
	pack: 'Marked as packed.',
	release: 'Hold released.',
	start: 'Packing started.',
} as const;

/** Start packing, mark packed, hold and release are one form; the pressed button names the step. */
export const updateOrderForm = Remote.Form(OrderStepSchema, async ({ number, step }) => {
	await FulfilmentManager.applyStep(number, step);
	await getOrder(number).refresh();
	return FormResult.ok(STEP_MESSAGES[step]);
});

export const parcelForm = Remote.Form(
	ParcelSchema,
	async ({ format, number, weightGrams, ...size }) => {
		await FulfilmentManager.saveParcel(number, {
			format,
			heightMm: size.heightMm ?? null,
			lengthMm: size.lengthMm ?? null,
			weightGrams,
			widthMm: size.widthMm ?? null,
		});
		await getOrder(number).refresh();
		return FormResult.ok('Parcel details saved.');
	}
);

export const getShippingServices = Remote.Query(() => FulfilmentManager.shippingServices());

export const detailsForm = Remote.Form(OrderDetailsSchema, async ({ number, ...details }) => {
	const { labelStale } = await FulfilmentManager.saveDetails(number, { number, ...details });
	await getOrder(number).refresh();
	return FormResult.ok(
		labelStale
			? 'Details saved. The label no longer matches: print it again to replace it.'
			: 'Details saved.'
	);
});

/** Creates the label in Click & Drop. The page then opens it from `/orders/<number>/label`. */
export const createOrderLabel = Remote.Cmd(OrderNumber, async (number) => {
	await FulfilmentManager.createLabel(number);
	await getOrder(number).refresh();
});
