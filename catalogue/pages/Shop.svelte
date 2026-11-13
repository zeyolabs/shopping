<script lang="ts">
	import { resolve } from '$app/paths';
	import PageTitle from '../../ui/PageTitle.svelte';
	import ProductCard from '../components/ProductCard.svelte';
	import type { getShop } from '../client.remote';

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

<!-- In stock first; the database order (sort order, then name) is kept within each group. -->
{let sorted = $derived([
	...shop.products.filter((p) => p.stock > 0),
	...shop.products.filter((p) => p.stock <= 0),
])}

<PageTitle {description} title="Shop" />

{#if intro}
	<p class="-mt-6 mb-6 max-w-prose text-[var(--txs)]">{intro}</p>
{/if}

<nav class="mb-8" aria-label="Categories">
	<ul class="flex flex-wrap gap-2">
		{#each shop.categories as category (category.id)}
			<li>
				<a
					class="inline-block rounded-full border border-[var(--bd)] px-3.5 py-1.5 text-sm hover:border-[var(--primary-strong)] hover:bg-[var(--primary-soft)]"
					href={resolve('/category/[slug]', { slug: category.slug })}>{category.name}</a
				>
			</li>
		{/each}
	</ul>
</nav>

{#if sorted.length === 0}
	<p>No products available right now. Please check back soon.</p>
{:else}
	<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each sorted as product (product.id)}
			<li><ProductCard {product} /></li>
		{/each}
	</ul>
{/if}
