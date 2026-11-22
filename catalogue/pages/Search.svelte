<script lang="ts">
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import type { searchShop } from '../client.remote';

	import ProductCard from '../components/ProductCard.svelte';

	let {
		search,
	}: {
		/** From the route's server `load` (`searchLoad`). */
		search: Awaited<ReturnType<typeof searchShop>>;
	} = $props();
</script>

<Head description="Search the shop." title="Search" />
<Title class="mb-10 text-[var(--primary-strong)]" level={1}>Search</Title>

<svelte:head>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<form class="mb-8 max-w-xl" action="/search" method="get" role="search">
	<Cluster gap="xs" nowrap>
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
			class="h-[var(--control-h)] rounded-md bg-[var(--primary-strong)] px-4 text-white"
			type="submit"><Span bold>Search</Span></button
		>
	</Cluster>
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
