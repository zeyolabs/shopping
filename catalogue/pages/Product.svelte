<script lang="ts">
	import type { Snippet } from 'svelte';

	import { resolve } from '$app/paths';
	import PageTitle from '../../ui/PageTitle.svelte';
	import Reviews from '../../reviews/components/Reviews.svelte';
	import Stars from '../../ui/Stars.svelte';
	import { addToBasket } from '../../basket/client.remote';
	import type { getProduct } from '../client.remote';
	import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import { Stock } from '../../stock/library';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import ImageGallery from '@zeyolabs/ui/gallery/ImageGallery.svelte';

	let {
		data,
		outOfStock,
	}: {
		/** From the route's server `load` (`productLoad`). */
		data: Awaited<ReturnType<typeof getProduct>>;
		/** What to show instead of the buy button when the product is out of stock, e.g. a back-in-stock form. */
		outOfStock?: Snippet<[productId: number]>;
	} = $props();

	const context = shopContext();

	async function add(productId: number) {
		try {
			await addToBasket({ productId, quantity: 1 });
			toast.success('Added to your basket');
		} catch {
			toast.error('Could not add to basket. Please try again.');
		}
	}
</script>

{let product = $derived(data.product)}
{let stockBadge = $derived(Stock.badge(product.stock, product.lowStockThreshold))}

<PageTitle
	description={(product.shortDescription || product.description).slice(0, 160)}
	title={product.name}
/>

<div class="grid gap-8 md:grid-cols-2">
	{#key product.id}
		<ImageGallery
			name={product.name}
			images={product.images.map((image) => ({
				alt: image.alt,
				src: Images.url(context.imageBaseUrl, image.src),
			}))}
		/>
	{/key}
	<div>
		{#if data.reviews.average !== null}
			<a class="mb-2 flex items-center gap-2 text-sm no-underline" href="#reviews-heading">
				<Stars rating={data.reviews.average} size="text-sm" />
				{data.reviews.count}
				{data.reviews.count === 1 ? 'review' : 'reviews'}
			</a>
		{/if}
		<p class="text-2xl">
			{Money.format(product.pricePence)}
			{#if product.comparePricePence && product.comparePricePence > product.pricePence}
				<s class="text-base opacity-60">{Money.format(product.comparePricePence)}</s>
			{/if}
		</p>
		{#if data.options.length > 1}
			<p class="mt-4">
				{data.variationName}:
				{#each data.options as option (option.slug)}
					{#if option.slug === product.slug}
						<strong class="mr-2">{option.label}</strong>
					{:else}
						<a class="mr-2 underline" href={resolve('/product/[slug]', { slug: option.slug })}>
							{option.label}
						</a>
					{/if}
				{/each}
			</p>
		{/if}
		{#if product.shortDescription}<p class="mt-4">{product.shortDescription}</p>{/if}
		<p class="mt-4 whitespace-pre-line">{product.description}</p>
		<p class="mt-4">
			{#if stockBadge.kind === 'out'}Out of stock{:else if stockBadge.kind === 'low'}Only {stockBadge.count}
				left{:else}In stock{/if}
		</p>
		{#if product.stock > 0}
			<Button class="mt-4" onclick={() => add(product.id)} size="lg">
				<ShoppingBasket size={18} />
				Add to basket
			</Button>
		{/if}
		{#if product.stock <= 0}
			{@render outOfStock?.(product.id)}
		{/if}
	</div>
</div>

<Reviews reviews={data.reviews} />
