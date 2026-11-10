import type { EmailParams, EmailRow } from '@zeyolabs/kit/utils/email';

import { shopping } from '../config';
import { Money } from '../utils/money';

export type OrderEmailData = {
	address: {
		city?: null | string;
		country?: null | string;
		line1?: null | string;
		line2?: null | string;
		name: string;
		postal_code?: null | string;
	};
	/** Taken off by a promotion code at Checkout. */
	discountPence?: number;
	email: string;
	items: { name: string; quantity: number; unitPricePence: number }[];
	number: string;
	/** Link to the customer's order page, which shows dispatch and tracking as they happen. */
	orderUrl?: string;
	phone?: null | string;
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
};

const COUNTRIES: Record<string, string> = { GB: 'United Kingdom' };

function addressLines(address: OrderEmailData['address']): string[] {
	return [
		address.name,
		address.line1,
		address.line2,
		address.city,
		address.postal_code,
		address.country ? (COUNTRIES[address.country] ?? address.country) : undefined,
	].filter((line): line is string => Boolean(line));
}

function itemRows(order: OrderEmailData): EmailRow[] {
	return order.items.map((item) => ({
		label: item.name,
		sub: `${item.quantity} × ${Money.format(item.unitPricePence)}`,
		value: Money.format(item.quantity * item.unitPricePence),
	}));
}

function totalRows(order: OrderEmailData): EmailRow[] {
	return [
		{ label: 'Subtotal', value: Money.format(order.subtotalPence) },
		...(order.discountPence
			? [{ label: 'Discount', value: `-${Money.format(order.discountPence)}` }]
			: []),
		{
			label: 'Delivery',
			value: order.shippingPence === 0 ? 'Free' : Money.format(order.shippingPence),
		},
		{ label: 'Total', strong: true, value: Money.format(order.totalPence) },
	];
}

/** The order emails, as kit email params (the shop renders and sends them). */
export const OrderEmails = {
	/** What the customer receives once payment has gone through. */
	customer(order: OrderEmailData): EmailParams {
		const firstName = order.address.name.split(' ')[0] || 'there';
		return {
			badge: 'Paid',
			brand: shopping().brand,
			cta: order.orderUrl
				? { href: order.orderUrl, label: 'View your order' }
				: { href: `${shopping().siteUrl}/shipping`, label: 'Delivery and returns' },
			eyebrow: `Order ${order.number}`,
			footnote: `Keep this email as your receipt. Quote ${order.number} if you contact us.${order.orderUrl ? ' Your order link is private to you, so please do not share it.' : ''}`,
			heading: `Thank you, ${firstName}`,
			intro: [
				`We have your order and your payment of ${Money.format(order.totalPence)}. We will pack it carefully and send it by Royal Mail.`,
				'UK orders usually arrive 2 to 10 working days after dispatch.',
				...(order.orderUrl
					? ['Use the link below to see when it is dispatched and to track it.']
					: []),
			],
			preheader: `Order ${order.number} is confirmed. Thank you for shopping with ${shopping().brand.name}.`,
			sections: [
				{ rows: itemRows(order), title: 'Your order' },
				{ rows: totalRows(order) },
				{ lines: addressLines(order.address), title: 'Delivering to' },
			],
		};
	},

	/** The internal heads-up to the shop: who ordered what, and where it goes. */
	shop(order: OrderEmailData): EmailParams {
		return {
			badge: 'Paid',
			brand: shopping().brand,
			eyebrow: 'New order',
			heading: `${order.number}: ${Money.format(order.totalPence)}`,
			intro: [
				`${order.address.name} (${order.email}${order.phone ? `, ${order.phone}` : ''}) has paid.`,
			],
			preheader: `New order ${order.number} for ${Money.format(order.totalPence)}`,
			sections: [
				{ rows: itemRows(order), title: 'Items' },
				{ rows: totalRows(order) },
				{ lines: addressLines(order.address), title: 'Ship to' },
			],
		};
	},
};
