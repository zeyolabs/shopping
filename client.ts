import { getContext, setContext } from 'svelte';

/**
 * What pages need in the browser. The server config in `config.ts` never reaches the client, so
 * the app hands these over once from its root layout with `setShoppingClient`.
 */
export type ShoppingClient = {
	imageBaseUrl: string;
	siteName: string;
	siteUrl: string;
	supportEmail: string;
};

const KEY = Symbol('@zeyolabs/shopping-client');

export function setShoppingClient(client: ShoppingClient): void {
	setContext(KEY, client);
}

export function shoppingClient(): ShoppingClient {
	const client = getContext<ShoppingClient | undefined>(KEY);
	if (!client) throw new Error('@zeyolabs/shopping: call setShoppingClient() in the root layout');
	return client;
}
