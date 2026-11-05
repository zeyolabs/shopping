<script lang="ts">
	import { page } from '$app/state';

	import { shoppingClient } from '../client';

	let { description, title }: { description: string; title: string } = $props();

	const client = shoppingClient();
	// Canonical ignores the query string, so `?show=N` deep links don't count as duplicate pages.
	const canonical = $derived(`${client.siteUrl}${page.url.pathname}`);
</script>

<svelte:head>
	<title>{title} | {client.siteName}</title>
	<meta name="description" content={description} />
	<link href={canonical} rel="canonical" />
	<meta content={client.siteName} property="og:site_name" />
	<meta content={title} property="og:title" />
	<meta content={description} property="og:description" />
	<meta content={canonical} property="og:url" />
	<meta content="website" property="og:type" />
</svelte:head>

<h1 class="mb-10 text-4xl font-semibold tracking-tight text-[var(--primary-strong)]">{title}</h1>
