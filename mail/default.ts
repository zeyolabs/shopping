import type { IMailClient } from '@zeyolabs/kit/email/base';

import { renderEmail, renderEmailText } from '@zeyolabs/kit/utils/email';

import type { ShopMail } from '../config';

import { shopping } from '../config';
import { DispatchEmail } from '../fulfilment/dispatch-email';
import { OrderEmails } from '../orders/email';
import { BackInStockEmail } from '../stock-alerts/email';
import { Money } from '../utils/money';

/**
 * The package's own emails, rendered with the shop's brand and delivered with `mailer()`. A site that wants
 * different wording or layout writes its own `ShopMail` instead.
 */
export function defaultShopMail({
	mailer,
	notifyEmail,
}: {
	/** The shop's email client, called once per message. */
	mailer: () => IMailClient;
	/** The shop's own inbox, told about every new order. */
	notifyEmail: string;
}): ShopMail {
	return {
		backInStock: async (alert) => {
			const site = shopping();
			const { brand } = site;
			const email = BackInStockEmail.build(alert, site);
			await mailer().deliver({
				from: brand.supportEmail,
				fromName: brand.name,
				html: renderEmail(email),
				subject: `${alert.productName} is back in stock`,
				text: renderEmailText(email),
				to: alert.email,
			});
		},
		newOrderAlert: async (order) => {
			const site = shopping();
			const { brand } = site;
			const email = OrderEmails.shop(order, site);
			await mailer().deliver({
				from: brand.supportEmail,
				fromName: `${brand.name} Admin`,
				html: renderEmail(email),
				replyTo: { email: order.email },
				subject: `New order ${order.number} (${Money.format(order.totalPence)})`,
				text: renderEmailText(email),
				to: notifyEmail,
			});
		},
		orderConfirmed: async (order) => {
			const site = shopping();
			const { brand } = site;
			const email = OrderEmails.customer(order, site);
			await mailer().deliver({
				from: brand.supportEmail,
				fromName: brand.name,
				html: renderEmail(email),
				subject: `Your ${brand.name} order ${order.number}`,
				text: renderEmailText(email),
				to: order.email,
			});
		},
		orderDispatched: async (order) => {
			const site = shopping();
			const { brand } = site;
			const email = DispatchEmail.build(order, site);
			await mailer().deliver({
				from: brand.supportEmail,
				fromName: brand.name,
				html: renderEmail(email),
				subject: `Your ${brand.name} order ${order.number} has been dispatched`,
				text: renderEmailText(email),
				to: order.email,
			});
		},
	};
}
