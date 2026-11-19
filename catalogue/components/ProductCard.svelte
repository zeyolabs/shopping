<script lang="ts">
	import { resolve } from '$app/paths';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';

	import { shopContext } from '../../context';
	import { Stock } from '../../stock/library';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';

	type Product = {
		comparePricePence: null | number;
		cover?: { alt: string; src: string };
		/** Show "Only N left" when the sellable stock is at or below this. */
		lowStockThreshold?: null | number;
		name: string;
		pricePence: number;
		slug: string;
		stock: number;
	};

	let { product }: { product: Product } = $props();

	const context = shopContext();

	const badge = $derived(Stock.badge(product.stock, product.lowStockThreshold));
	const onSale = $derived(
		product.comparePricePence !== null && product.comparePricePence > product.pricePence
	);
</script>

<!--
	Concentric corners: the card is 16px (rounded-2xl) with 8px of padding, so the photo inside is
	rounded-md (16 - 8 = 8px, on this project's radius scale) and its corners follow the card's curve instead of poking into it.
-->
<a
	class="group block rounded-2xl border border-[var(--bd)] bg-white p-2 text-[var(--tx)] no-underline transition hover:border-[var(--primary-strong)] hover:text-[var(--tx)] hover:shadow-md"
	href={resolve('/product/[slug]', { slug: product.slug })}
>
	<div class="relative aspect-square overflow-hidden rounded-md bg-[var(--sfh)]">
		{#if product.cover}
			<img
				class="size-full object-cover transition duration-300 group-hover:scale-105 {product.stock <=
				0
					? 'opacity-60'
					: ''}"
				alt={product.cover.alt || product.name}
				loading="lazy"
				src={Images.url(context.imageBaseUrl, product.cover.src)}
			/>
		{/if}
		{#if badge.kind === 'out'}
			<Span
				class="absolute top-2 left-2 rounded-full bg-white/95 px-2.5 py-1 shadow-sm"
				bold
				color="secondary"
				size="sm">Out of stock</Span
			>
		{:else if badge.kind === 'low'}
			<Span
				class="absolute top-2 left-2 rounded-full bg-white/95 px-2.5 py-1 shadow-sm"
				bold
				color="secondary"
				size="sm">Only {badge.count} left</Span
			>
		{:else if onSale}
			<Span
				class="absolute top-2 left-2 rounded-full bg-[var(--primary-strong)] px-2.5 py-1 text-white"
				bold
				size="sm">Sale</Span
			>
		{/if}
	</div>
	<div class="px-2 pt-3 pb-2">
		<Text bold>{product.name}</Text>
		<Text class="mt-1" color="secondary">
			<Span bold>{Money.format(product.pricePence)}</Span>
			{#if onSale}
				<s class="ml-1 text-sm">{Money.format(product.comparePricePence!)}</s>
			{/if}
		</Text>
	</div>
</a>
