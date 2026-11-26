import { getContext, setContext } from 'svelte';

/**
 * What pages need in the browser. The server config in `config.ts` never reaches the client, so
 * the app hands these over once from its root layout with `setShopContext`.
 */
export type ShopContext = {
	/** Absolute URL of the link-preview picture for pages with no image of their own. Unset: the site's share image, if any. */
	defaultOgImage?: string;
	imageBaseUrl: string;
	/** Absolute URL of the shop's logo, for the home page's `Organization` data. Unset: left out. */
	logoUrl?: string;
	siteName: string;
	siteUrl: string;
	supportEmail: string;
};

const KEY = Symbol('@zeyolabs/shopping-context');

export function setShopContext(client: ShopContext): void {
	setContext(KEY, client);
}

export function shopContext(): ShopContext {
	const client = getContext<ShopContext | undefined>(KEY);
	if (!client) throw new Error('@zeyolabs/shopping: call setShopContext() in the root layout');
	return client;
}
