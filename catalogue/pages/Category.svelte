<script lang="ts">
	import { resolve } from '$app/paths';
	import { shopContext } from '../../context';
	import PageLinks from '../../ui/PageLinks.svelte';
	import PageTitle from '../../ui/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';
	import type { getCategoryPage } from '../client.remote';

	/** From the route's server `load` (`categoryLoad`). */
	let { data }: { data: Awaited<ReturnType<typeof getCategoryPage>> } = $props();

	const context = shopContext();
</script>

<p class="mb-2 text-sm"><a class="underline" href={resolve('/shop')}>All products</a></p>
<PageTitle
	description="Buy {data.category.name} from {context.siteName}."
	title={data.category.name}
/>

{#if data.category.description}
	<p class="-mt-6 mb-6 max-w-prose whitespace-pre-line text-[var(--txs)]">
		{data.category.description}
	</p>
{/if}

{#if data.products.length === 0}
	<p>No products available right now. Please check back soon.</p>
{:else}
	<p class="mb-4 text-sm text-[var(--txs)]">
		{data.total}
		{data.total === 1 ? 'product' : 'products'}{#if data.pages > 1}, page {data.page} of {data.pages}{/if}
	</p>
	<ul class="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
		{#each data.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
	<PageLinks page={data.page} pages={data.pages} />
{/if}
