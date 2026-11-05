<script lang="ts">
	import { resolve } from '$app/paths';
	import { shoppingClient } from '../client';
	import PageTitle from '../components/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';
	import type { getCategoryPage } from '../remote/catalogue.remote';

	/** From the route's server `load` (`categoryLoad`). */
	let { data }: { data: Awaited<ReturnType<typeof getCategoryPage>> } = $props();

	const client = shoppingClient();
</script>

<p class="mb-2 text-sm"><a class="underline" href={resolve('/shop')}>All products</a></p>
<PageTitle
	description="Buy {data.category.name} from {client.siteName}."
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
	<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each data.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
{/if}
