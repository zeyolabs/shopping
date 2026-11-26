<script lang="ts">
	import { shopContext } from '../context';
	import JsonLd from './JsonLd.svelte';
	import { Seo } from './library';

	/** The home page's `Organization` and `WebSite` JSON-LD, from `setShopContext`. Put it on the home route. */
	const context = shopContext();

	const data = $derived(
		Seo.graph([
			Seo.organization({
				email: context.supportEmail,
				logo: context.logoUrl,
				name: context.siteName,
				url: context.siteUrl,
			}),
			Seo.website({ name: context.siteName, url: context.siteUrl }),
		])
	);
</script>

<JsonLd {data} />
