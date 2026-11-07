import { renderEmail, renderEmailText } from '@zeyolabs/kit/utils/email';

import type { ShopMail } from '../config';

import { shopping } from '../config';
import { backInStockEmail } from '../emails/back-in-stock';
import { dispatchEmail } from '../emails/dispatch';
import { customerOrderEmail, shopOrderEmail } from '../emails/order';
import { formatMoney } from '../money';

export type Message = {
	from: { email: string; name?: string };
	html?: string;
	reply?: { email: string; name?: string };
	subject: string;
	text: string;
	to: string;
};

/**
 * The package's own emails, rendered with the shop's brand and handed to `send`. A site that wants
 * different wording or layout writes its own `ShopMail` instead.
 */
export function defaultShopMail({
	notifyEmail,
	send,
}: {
	/** The shop's own inbox, told about every new order. */
	notifyEmail: string;
	send: (message: Message) => Promise<void>;
}): ShopMail {
	return {
		backInStock: async (alert) => {
			const { brand } = shopping();
			const email = backInStockEmail(alert);
			await send({
				from: { email: brand.supportEmail, name: brand.name },
				html: renderEmail(email),
				subject: `${alert.productName} is back in stock`,
				text: renderEmailText(email),
				to: alert.email,
			});
		},
		newOrderAlert: async (order) => {
			const { brand } = shopping();
			const email = shopOrderEmail(order);
			await send({
				from: { email: brand.supportEmail, name: `${brand.name} website` },
				html: renderEmail(email),
				reply: { email: order.email },
				subject: `New order ${order.number} (${formatMoney(order.totalPence)})`,
				text: renderEmailText(email),
				to: notifyEmail,
			});
		},
		orderConfirmed: async (order) => {
			const { brand } = shopping();
			const email = customerOrderEmail(order);
			await send({
				from: { email: brand.supportEmail, name: brand.name },
				html: renderEmail(email),
				subject: `Your ${brand.name} order ${order.number}`,
				text: renderEmailText(email),
				to: order.email,
			});
		},
		orderDispatched: async (order) => {
			const { brand } = shopping();
			const email = dispatchEmail(order);
			await send({
				from: { email: brand.supportEmail, name: brand.name },
				html: renderEmail(email),
				subject: `Your ${brand.name} order ${order.number} has been dispatched`,
				text: renderEmailText(email),
				to: order.email,
			});
		},
	};
}
