import type { EmailParams } from '@zeyolabs/kit/utils/email';

import { shopping } from '../config';
import { Orders } from '../orders/library';

export type DispatchEmailData = {
	address: {
		city: string;
		country: string;
		line1: string;
		line2?: null | string;
		name: string;
		postcode: string;
	};
	email: string;
	number: string;
	/** Access token of the order page. */
	token: string;
	trackingNumber?: null | string;
};

/** The dispatch email, as kit email params. */
export const DispatchEmail = {
	/** Sent when the order leaves the shop: where it is, and how to follow it. */
	build(order: DispatchEmailData): EmailParams {
		const firstName = order.address.name.split(' ')[0] || 'there';
		const tracked = Boolean(order.trackingNumber);
		return {
			badge: 'Dispatched',
			brand: shopping().brand,
			cta: tracked
				? { href: Orders.trackingUrl(order.trackingNumber!), label: 'Track your parcel' }
				: {
						href: Orders.url(shopping().siteUrl, order.number, order.token),
						label: 'View your order',
					},
			eyebrow: `Order ${order.number}`,
			footnote: tracked
				? `Your tracking number is ${order.trackingNumber}. It can take a few hours for Royal Mail's tracking to show movement.`
				: 'This parcel is sent untracked.',
			heading: `Your order is on its way, ${firstName}`,
			intro: [
				`Your order ${order.number} has been dispatched by Royal Mail. UK orders usually arrive 2 to 10 working days after dispatch.`,
				...(tracked
					? [
							`You can also see it any time on your order page: ${Orders.url(shopping().siteUrl, order.number, order.token)}`,
						]
					: []),
			],
			preheader: `Order ${order.number} has been dispatched. Thank you for shopping with ${shopping().brand.name}.`,
			sections: [
				{
					lines: [
						order.address.name,
						order.address.line1,
						order.address.line2,
						order.address.city,
						order.address.postcode,
						order.address.country,
					].filter((line): line is string => Boolean(line)),
					title: 'Delivering to',
				},
			],
		};
	},
};
