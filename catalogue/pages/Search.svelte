<script lang="ts">
	import PageTitle from '../../ui/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';
	import type { searchShop } from '../client.remote';

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
	<p class="text-[var(--txs)]">Type what you are looking for.</p>
{:else if search.products.length === 0}
	<p>Nothing matches "{search.query}". Try fewer or different words.</p>
{:else}
	<p class="mb-4 text-[var(--txs)]" aria-live="polite">
		{search.products.length === 48 ? 'Top 48' : search.products.length}
		{search.products.length === 1 ? 'result' : 'results'} for "{search.query}"
	</p>
	<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each search.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
{/if}
