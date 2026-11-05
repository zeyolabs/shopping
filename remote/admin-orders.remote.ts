import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { Error404 } from '@zeyolabs/kit/utils/errors';
import { FormResult } from '@zeyolabs/kit/utils/form';

import {
	OrderListSchema,
	OrderNumber,
	OrderStepSchema,
	ParcelSchema,
	ShipSchema,
} from '../admin/orders.schema';
import {
	applyStep,
	countOrders,
	createLabel,
	findOrder,
	listOrders,
	markShipped,
	saveParcel,
} from '../server/admin-orders';

export const getOrders = Remote.Query(OrderListSchema, ({ filter, q }) => listOrders(filter, q));

export const getOrderCounts = Remote.Query(() => countOrders());

export const getOrder = Remote.Query(OrderNumber, async (number) => {
	const order = await findOrder(number);
	if (!order) throw Error404('Order not found.');
	return order;
});

export const shipForm = Remote.Form(ShipSchema, async ({ number, trackingNumber }) => {
	const { emailed } = await markShipped(number, trackingNumber || null);
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
	await applyStep(number, step);
	await getOrder(number).refresh();
	return FormResult.ok(STEP_MESSAGES[step]);
});

export const parcelForm = Remote.Form(
	ParcelSchema,
	async ({ format, number, weightGrams, ...size }) => {
		await saveParcel(number, {
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

/** Creates the label in Click & Drop. The page then opens it from `/orders/<number>/label`. */
export const createOrderLabel = Remote.Cmd(OrderNumber, async (number) => {
	await createLabel(number);
	await getOrder(number).refresh();
});
