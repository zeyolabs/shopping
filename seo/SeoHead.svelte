<script lang="ts">
	import Head from '@zeyolabs/ui/head/Head.svelte';

	import type { JsonLdNode } from './library';

	import { shopContext } from '../context';
	import JsonLd from './JsonLd.svelte';

	/**
	 * A page's `<head>`: the title, description and canonical of `Head`, a link-preview picture (the
	 * page's own, else the shop's `defaultOgImage`; `Head` falls back to the site's share image for `og:image`), Twitter card tags and
	 * the page's JSON-LD. `image` is an absolute URL.
	 */
	let {
		canonical,
		description,
		image,
		jsonLd,
		title,
	}: {
		canonical?: string;
		description: string;
		image?: string;
		jsonLd?: JsonLdNode;
		title?: string;
	} = $props();

	const context = shopContext();
	const picture = $derived(image ?? context.defaultOgImage);
</script>

<Head {canonical} {description} image={image ?? context.defaultOgImage} {title} />
<svelte:head>
	<meta name="twitter:card" content={picture ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title ?? context.siteName} />
	<meta name="twitter:description" content={description} />
	{#if picture}
		<meta name="twitter:image" content={picture} />
	{/if}
</svelte:head>
{#if jsonLd}
	<JsonLd data={jsonLd} />
{/if}
