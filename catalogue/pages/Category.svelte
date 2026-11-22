<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import type { getCategoryPage } from '../client.remote';

	import { shopContext } from '../../context';
	import PageLinks from '../../ui/PageLinks.svelte';
	import ProductCard from '../components/ProductCard.svelte';

	/** From the route's server `load` (`categoryLoad`). */
	let { data }: { data: Awaited<ReturnType<typeof getCategoryPage>> } = $props();

	const context = shopContext();

	// Each listing page is its own page, so `?page=N` stays in the canonical; other parameters don't.
	const listingPage = $derived(Number(page.url.searchParams.get('page')) || 1);
	const canonical = $derived(
		listingPage > 1 ? `${page.url.pathname}?page=${listingPage}` : page.url.pathname
	);
</script>

<Text class="mb-2"><a class="underline" href={resolve('/shop')}>All products</a></Text>
<Head
	{canonical}
	description="Buy {data.category.name} from {context.siteName}."
	title={data.category.name}
/>
<Title class="mb-10 text-[var(--primary-strong)]" level={1}>{data.category.name}</Title>

{#if data.category.description}
	<Text class="-mt-6 mb-6 max-w-prose whitespace-pre-line" color="secondary">
		{data.category.description}
	</Text>
{/if}

{#if data.products.length === 0}
	<Text>No products available right now. Please check back soon.</Text>
{:else}
	<Text class="mb-4" color="secondary">
		{data.total}
		{data.total === 1 ? 'product' : 'products'}{#if data.pages > 1}, page {data.page} of {data.pages}{/if}
	</Text>
	<ul class="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
		{#each data.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
	<PageLinks page={data.page} pages={data.pages} />
{/if}
