import type { EmailBrand } from '@zeyolabs/kit/utils/email';

import { envStore } from '@zeyolabs/kit/utils/env';

import type { ShopDb } from './db';
import type { BackInStockEmailData } from './emails/back-in-stock';
import type { DispatchEmailData } from './emails/dispatch';
import type { OrderEmailData } from './emails/order';

/**
 * Names of the secrets the shop reads, as they are called in the app's wrangler config. The app must
 * list them in the `secretNames` it gives `runWithContext`, so `EnvStore` resolves them.
 */
export type ShoppingSecrets = {
	royalMailApiKey: string;
	stripeSecretKey: string;
	stripeWebhookSecret: string;
};

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
 * (`@zeyolabs/shopping/server/mail`) is the package's own wording; a site can use it or write its own.
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

/** Everything that differs between sites. The package holds no brand, address or account of its own. */
export type ShoppingConfig = {
	brand: EmailBrand;
	db: () => ShopDb;
	/** Where product image files are served from; the database stores only file names. */
	imageBaseUrl: string;
	mail: ShopMail;
	/** Letters before the random part of an order number, e.g. `PL` for `PL-ABC123`. */
	orderNumberPrefix: string;
	secrets: ShoppingSecrets;
	shipping: ShippingRules;
	siteUrl: string;
};

let current: ShoppingConfig | undefined;

/** Called once at startup by each app (see its `src/lib/server/shopping.ts`). */
export function configureShopping(config: ShoppingConfig): void {
	current = config;
}

export function shopping(): ShoppingConfig {
	if (!current)
		throw new Error('@zeyolabs/shopping is not configured: call configureShopping() first');
	return current;
}

/** A secret by its role (`stripeSecretKey`); the config says what it is called in this app. */
export function secret(key: keyof ShoppingSecrets): string {
	return envStore().secret(shopping().secrets[key]);
}
