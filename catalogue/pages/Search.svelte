<script lang="ts">
	import Text from '@zeyolabs/ui/text/Text.svelte';

	import type { searchShop } from '../client.remote';

	import PageTitle from '../../ui/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';

	let {
		search,
	}: {
		/** From the route's server `load` (`searchLoad`). */
		search: Awaited<ReturnType<typeof searchShop>>;
	} = $props();
</script>

<PageTitle description="Search the shop." title="Search" />

<svelte:head>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<form class="mb-8 flex max-w-xl gap-2" action="/search" method="get" role="search">
	<label class="sr-only" for="shop-search">Search products</label>
	<input
		id="shop-search"
		name="q"
		class="h-[var(--control-h)] min-w-0 flex-1 rounded-md border border-[var(--bd)] bg-white px-3"
		autocomplete="off"
		maxlength="100"
		placeholder="Search products"
		type="search"
		value={search.query}
	/>
	<button
		class="h-[var(--control-h)] rounded-md bg-[var(--primary-strong)] px-4 font-medium text-white"
		type="submit">Search</button
	>
</form>

{#if search.query === ''}
	<Text color="secondary">Type what you are looking for.</Text>
{:else if search.products.length === 0}
	<Text>Nothing matches "{search.query}". Try fewer or different words.</Text>
{:else}
	<div class="mb-4" aria-live="polite">
		<Text color="secondary">
			{search.products.length === 48 ? 'Top 48' : search.products.length}
			{search.products.length === 1 ? 'result' : 'results'} for "{search.query}"
		</Text>
	</div>
	<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each search.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
{/if}
