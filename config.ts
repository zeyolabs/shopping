import type { EmailBrand } from '@zeyolabs/kit/utils/email';

import { envStore } from '@zeyolabs/kit/utils/env';

import type { ShopDb } from './db/index';
import type { DispatchEmailData } from './fulfilment/dispatch-email';
import type { OrderEmailData } from './orders/email';
import type { BackInStockEmailData } from './stock-alerts/email';

const SHOP_SECRETS = {
	royalMailApiKey: 'ROYALMAIL_API_KEY',
	stripeSecretKey: 'STRIPE_SECRET_KEY',
	stripeWebhookSecret: 'STRIPE_WEBHOOK_SECRET',
} as const;

/** Postage rules layered on the per-zone rate table. */
export type ShippingRules = {
	defaultCountry: string;
	/** UK orders at or above this subtotal ship free. */
	freeUkFromPence: number;
	/** International parcels worth at least this get a flat insurance uplift. */
	insuranceFromPence: number;
	insuranceUpliftPence: number;
	/** At or above this no international service covers the value, so the order can't ship abroad. */
	internationalMaxOrderPence: number;
};

/**
 * What the shop sends, one function per email, each given the order details. `defaultShopMail`
 * (`@zeyolabs/shopping/mail/default`) is the package's own wording; a site can use it or write its own.
 */
export type ShopMail = {
	/**
	 * Tells a customer that a sold-out product they asked about is available again. Optional so shops
	 * that predate it keep working; without it the back-in-stock job sends nothing.
	 */
	backInStock?: (alert: BackInStockEmailData) => Promise<void>;
	/** The shop's own heads-up that an order was paid. */
	newOrderAlert: (order: OrderEmailData) => Promise<void>;
	/** The customer's receipt. */
	orderConfirmed: (order: OrderEmailData) => Promise<void>;
	orderDispatched: (order: DispatchEmailData) => Promise<void>;
};

/** Stripe Checkout options. Both are off unless the site turns them on. */
export type CheckoutOptions = {
	/**
	 * Have Stripe issue a numbered, paid invoice (PDF) for every order and email it with the
	 * receipt. Stripe charges per invoice. `customFields` appear on the invoice, e.g. the VAT number
	 * (up to 4); `footer` is printed at the bottom, e.g. the registered company details.
	 */
	invoices?: {
		customFields?: { name: string; value: string }[];
		footer?: string;
	};
	/**
	 * Let customers enter a Stripe promotion code at Checkout. Codes, coupons and their limits are
	 * created and managed in the Stripe dashboard; the shop stores only the discount on each order.
	 */
	promotionCodes?: boolean;
};

/** Who the shop is and where it lives: what the emails need to name and link to it. */
export type ShopSite = Pick<ShoppingConfig, 'brand' | 'siteUrl'>;

/** Everything that differs between sites. The package holds no brand, address or account of its own. */
export type ShoppingConfig = {
	brand: EmailBrand;
	checkout?: CheckoutOptions;
	db: () => ShopDb;
	mail: ShopMail;
	/** Letters before the random part of an order number, e.g. `PL` for `PL-ABC123`. */
	orderNumberPrefix: string;
	shipping: ShippingRules;
	siteUrl: string;
};

let current: ShoppingConfig | undefined;

export function configureShopping(config: ShoppingConfig): void {
	current = config;
}

export function shopping(): ShoppingConfig {
	if (!current)
		throw new Error('@zeyolabs/shopping is not configured: call configureShopping() first');
	return current;
}

export function secret(key: keyof typeof SHOP_SECRETS): string {
	return envStore().secret(SHOP_SECRETS[key]);
}
