<script lang="ts">
	import { page } from '$app/state';

	import { shopContext } from '../context';

	let {
		description,
		heading = true,
		title,
	}: {
		description: string;
		/** False when the page renders its own `<h1>` (the product page puts it beside the gallery). */
		heading?: boolean;
		title: string;
	} = $props();

	const context = shopContext();
	// Canonical drops the query string except `?page=N` (each listing page is its own page), so
	// other parameters don't count as duplicate pages.
	const listingPage = $derived(Number(page.url.searchParams.get('page')) || 1);
	const canonical = $derived(
		`${context.siteUrl}${page.url.pathname}${listingPage > 1 ? `?page=${listingPage}` : ''}`
	);
</script>

<svelte:head>
	<title>{title} | {context.siteName}</title>
	<meta name="description" content={description} />
	<link href={canonical} rel="canonical" />
	<meta content={context.siteName} property="og:site_name" />
	<meta content={title} property="og:title" />
	<meta content={description} property="og:description" />
	<meta content={canonical} property="og:url" />
	<meta content="website" property="og:type" />
</svelte:head>

{#if heading}
	<h1 class="mb-10 text-4xl font-semibold tracking-tight text-[var(--primary-strong)]">{title}</h1>
{/if}
