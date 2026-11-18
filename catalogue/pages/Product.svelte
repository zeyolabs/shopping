<script lang="ts">
	import type { Snippet } from 'svelte';

	import { resolve } from '$app/paths';
	import PageTitle from '../../ui/PageTitle.svelte';
	import Reviews from '../../reviews/components/Reviews.svelte';
	import Stars from '../../ui/Stars.svelte';
	import { addToBasketForm } from '../../basket/client.remote';
	import { AddToBasketSchema } from '../../basket/schema';
	import type { getProduct } from '../client.remote';
	import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import { Stock } from '../../stock/library';
	import { ProductText } from '../library';
	import { Form } from '@zeyolabs/ui/form';
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

	const STOCK_DOT = { in: 'bg-[var(--primary)]', low: 'bg-amber-500', out: 'bg-[var(--txt)]' };
</script>

{let product = $derived(data.product)}
{let stockBadge = $derived(Stock.badge(product.stock, product.lowStockThreshold))}
{let text = $derived(ProductText.parse(product.description))}
{let visible = $derived(ProductText.visibleCount(text.paragraphs))}
{let saving = $derived(
	product.comparePricePence && product.comparePricePence > product.pricePence
		? Math.round((1 - product.pricePence / product.comparePricePence) * 100)
		: 0
)}

<PageTitle
	description={(product.shortDescription || product.description).slice(0, 160)}
	heading={false}
	title={product.name}
/>

<div class="grid gap-8 md:grid-cols-2 lg:gap-14">
	<div class="md:sticky md:top-6 md:self-start">
		{#key product.id}
			<ImageGallery
				name={product.name}
				images={product.images.map((image) => ({
					alt: image.alt,
					src: Images.url(context.imageBaseUrl, image.src),
				}))}
			/>
		{/key}
	</div>

	<div class="flex flex-col">
		<h1 class="text-3xl font-semibold tracking-tight text-[var(--tx)] sm:text-4xl">
			{product.name}
		</h1>

		{#if data.reviews.average !== null}
			<a
				class="mt-3 flex w-fit items-center gap-2 text-sm text-[var(--txs)] no-underline hover:text-[var(--tx)]"
				href="#reviews-heading"
			>
				<Stars rating={data.reviews.average} size="text-sm" />
				{data.reviews.count}
				{data.reviews.count === 1 ? 'review' : 'reviews'}
			</a>
		{/if}

		<div class="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span class="text-3xl font-semibold text-[var(--tx)]">{Money.format(product.pricePence)}</span
			>
			{#if saving > 0}
				<s class="text-lg text-[var(--txt)]">{Money.format(product.comparePricePence!)}</s>
				<span
					class="rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-sm font-medium text-[var(--primary-strong)]"
				>
					Save {saving}%
				</span>
			{/if}
		</div>
		{#if product.packSize > 1}
			<p class="mt-1 text-sm text-[var(--txs)]">Pack of {product.packSize}</p>
		{/if}

		{#if product.shortDescription}
			<p class="mt-5 text-[var(--txs)]">{product.shortDescription}</p>
		{/if}

		{#if data.options.length > 1}
			<div class="mt-6">
				<p class="text-sm font-medium text-[var(--tx)]">{data.variationName}</p>
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each data.options as option (option.slug)}
						<li>
							{#if option.slug === product.slug}
								<span
									class="inline-flex rounded-full border-2 border-[var(--primary-strong)] bg-[var(--primary-soft)] px-4 py-1.5 text-sm font-medium text-[var(--primary-strong)]"
									aria-current="true"
								>
									{option.label}
								</span>
							{:else}
								<a
									class="inline-flex rounded-full border-2 border-[var(--bd)] px-4 py-1.5 text-sm text-[var(--tx)] no-underline transition hover:border-[var(--primary-strong)] hover:text-[var(--tx)]"
									href={resolve('/product/[slug]', { slug: option.slug })}
								>
									{option.label}
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<p class="mt-6 flex items-center gap-2 text-sm font-medium text-[var(--tx)]">
			<span class="size-2.5 rounded-full {STOCK_DOT[stockBadge.kind]}" aria-hidden="true"></span>
			{#if stockBadge.kind === 'out'}Out of stock{:else if stockBadge.kind === 'low'}Only {stockBadge.count}
				left{:else}In stock{/if}
		</p>

		{#if product.stock > 0}
			{const form = addToBasketForm.for(product.id)}
			<Form
				class="mt-4"
				{form}
				hidden={{ productId: product.id, quantity: 1 }}
				reset={false}
				schema={AddToBasketSchema}
			>
				<Button class="w-full sm:w-auto" {form} loadingMessage="Adding…" size="lg">
					<ShoppingBasket size={18} />
					Add to basket
				</Button>
			</Form>
		{:else}
			<div class="mt-4">{@render outOfStock?.(product.id)}</div>
		{/if}

		{#if text.specs.length > 0}
			<dl
				class="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bd)]"
			>
				{#each text.specs.slice(0, 4) as spec (spec.label)}
					<div class="bg-[var(--sf)] px-4 py-3">
						<dt class="text-xs text-[var(--txs)]">{spec.label}</dt>
						<dd class="mt-0.5 font-medium text-[var(--tx)]">{spec.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}
	</div>
</div>

{#if text.paragraphs.length > 0 || text.specs.length > 4}
	<section
		class="mt-16 grid gap-12 border-t border-[var(--bd)] pt-10 {text.specs.length > 4 &&
		text.paragraphs.length > 0
			? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
			: ''}"
	>
		{#if text.paragraphs.length > 0}
			<div class="max-w-prose">
				<h2 class="text-xl font-semibold tracking-tight text-[var(--tx)]">About this product</h2>
				{#snippet paragraph(p: { heading: null | string; text: string })}
					<div class="mt-5">
						{#if p.heading}<h3 class="text-base font-semibold tracking-normal text-[var(--tx)]">
								{p.heading}
							</h3>{/if}
						<p class="whitespace-pre-line text-[var(--txs)] {p.heading ? 'mt-1' : ''}">{p.text}</p>
					</div>
				{/snippet}
				{#each text.paragraphs.slice(0, visible) as p, i (i)}
					{@render paragraph(p)}
				{/each}
				{#if visible < text.paragraphs.length}
					<details class="group mt-5">
						<summary
							class="cursor-pointer list-none font-medium text-[var(--primary-strong)] group-open:hidden"
						>
							Read more
						</summary>
						{#each text.paragraphs.slice(visible) as p, i (i)}
							{@render paragraph(p)}
						{/each}
					</details>
				{/if}
			</div>
		{/if}
		{#if text.specs.length > 4}
			<div>
				<h2 class="text-xl font-semibold tracking-tight text-[var(--tx)]">Specifications</h2>
				<dl class="mt-5 divide-y divide-[var(--bd)] border-y border-[var(--bd)] text-sm">
					{#each text.specs as spec (spec.label)}
						<div class="flex justify-between gap-6 py-2.5">
							<dt class="text-[var(--txs)]">{spec.label}</dt>
							<dd class="text-right font-medium text-[var(--tx)]">{spec.value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/if}
	</section>
{/if}

<Reviews reviews={data.reviews} />
