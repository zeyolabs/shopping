<script lang="ts">
	import { resolve } from '$app/paths';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';

	import type { getShop } from '../client.remote';

	import PageLinks from '../../ui/PageLinks.svelte';
	import PageTitle from '../../ui/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';

	let {
		description,
		intro,
		shop,
	}: {
		/** The page's meta description. */
		description: string;
		/** One line under the title, e.g. what the shop sells. */
		intro?: string;
		/** From the route's server `load` (`shopLoad`). */
		shop: Awaited<ReturnType<typeof getShop>>;
	} = $props();
</script>

<PageTitle {description} title="Shop" />

{#if intro}
	<Text class="-mt-6 mb-6 max-w-prose" color="secondary">{intro}</Text>
{/if}

<nav class="mb-8" aria-label="Categories">
	<Cluster gap="xs">
		{#each shop.categories as category (category.id)}
			<a
				class="inline-block rounded-full border border-[var(--bd)] px-3.5 py-1.5 hover:border-[var(--primary-strong)] hover:bg-[var(--primary-soft)]"
				href={resolve('/category/[slug]', { slug: category.slug })}>{category.name}</a
			>
		{/each}
	</Cluster>
</nav>

<!-- In stock first (the query sorts by it, then sort order and name), one page at a time. -->
{#if shop.products.length === 0}
	<Text>No products available right now. Please check back soon.</Text>
{:else}
	<ul class="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
		{#each shop.products as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
	<PageLinks page={shop.page} pages={shop.pages} />
{/if}
