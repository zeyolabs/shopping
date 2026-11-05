<script lang="ts">
	import { resolve } from '$app/paths';
	import { shoppingClient } from '../client';
	import { productImageUrl } from '../images';
	import { formatMoney } from '../money';

	type Product = {
		comparePricePence: null | number;
		cover?: { alt: string; src: string };
		name: string;
		pricePence: number;
		slug: string;
		stock: number;
	};

	let { product }: { product: Product } = $props();

	const client = shoppingClient();

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
				src={productImageUrl(client.imageBaseUrl, product.cover.src)}
			/>
		{/if}
		{#if product.stock <= 0}
			<span
				class="absolute top-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-[var(--txs)] shadow-sm"
				>Out of stock</span
			>
		{:else if onSale}
			<span
				class="absolute top-2 left-2 rounded-full bg-[var(--primary-strong)] px-2.5 py-1 text-xs font-medium text-white"
				>Sale</span
			>
		{/if}
	</div>
	<div class="px-2 pt-3 pb-2">
		<p class="leading-snug font-medium">{product.name}</p>
		<p class="mt-1 text-[var(--txs)]">
			<span class="font-medium text-[var(--tx)]">{formatMoney(product.pricePence)}</span>
			{#if onSale}
				<s class="ml-1 text-sm">{formatMoney(product.comparePricePence!)}</s>
			{/if}
		</p>
	</div>
</a>
