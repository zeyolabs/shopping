<script lang="ts">
	import type { Snippet } from 'svelte';

	import { resolve } from '$app/paths';
	import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
	import { Form } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import ImageGallery from '@zeyolabs/ui/gallery/ImageGallery.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import type { getProduct } from '../client.remote';

	import { addToBasketForm } from '../../basket/client.remote';
	import { AddToBasketSchema } from '../../basket/schema';
	import { shopContext } from '../../context';
	import Reviews from '../../reviews/components/Reviews.svelte';
	import { Stock } from '../../stock/library';
	import PageTitle from '../../ui/PageTitle.svelte';
	import Stars from '../../ui/Stars.svelte';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import { ProductText } from '../library';

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
		<Title level={1} size="lg">{product.name}</Title>

		{#if data.reviews.average !== null}
			<a class="mt-3 w-fit no-underline" href="#reviews">
				<Cluster gap="xs">
					<Stars rating={data.reviews.average} size="sm" />
					<Span color="secondary">
						{data.reviews.count}
						{data.reviews.count === 1 ? 'review' : 'reviews'}
					</Span>
				</Cluster>
			</a>
		{/if}

		<Cluster class="mt-5" gap="sm">
			<!-- eslint-disable-next-line svelte/no-restricted-html-elements, no-restricted-syntax -- the price is display-sized, bigger than any Span size -->
			<span class="text-3xl font-semibold">{Money.format(product.pricePence)}</span>
			{#if saving > 0}
				<Span color="tertiary" size="lg"><s>{Money.format(product.comparePricePence!)}</s></Span>
				<Span
					class="rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-[var(--primary-strong)]"
					bold
				>
					Save {saving}%
				</Span>
			{/if}
		</Cluster>
		{#if product.packSize > 1}
			<Text class="mt-1" color="secondary">Pack of {product.packSize}</Text>
		{/if}

		{#if product.shortDescription}
			<Text class="mt-5" color="secondary">{product.shortDescription}</Text>
		{/if}

		{#if data.options.length > 1}
			<div class="mt-6">
				<Text bold>{data.variationName}</Text>
				<Cluster class="mt-2" gap="xs">
					{#each data.options as option (option.slug)}
						{#if option.slug === product.slug}
							<div
								class="inline-flex rounded-full border-2 border-[var(--primary-strong)] bg-[var(--primary-soft)] px-4 py-1.5 text-[var(--primary-strong)]"
								aria-current="true"
							>
								<Span bold>{option.label}</Span>
							</div>
						{:else}
							<a
								class="inline-flex rounded-full border-2 border-[var(--bd)] px-4 py-1.5 text-[var(--tx)] no-underline transition hover:border-[var(--primary-strong)] hover:text-[var(--tx)]"
								href={resolve('/product/[slug]', { slug: option.slug })}
							>
								<Span>{option.label}</Span>
							</a>
						{/if}
					{/each}
				</Cluster>
			</div>
		{/if}

		<Cluster class="mt-6" gap="xs">
			<div class="size-2.5 rounded-full {STOCK_DOT[stockBadge.kind]}" aria-hidden="true"></div>
			<Text bold>
				{#if stockBadge.kind === 'out'}Out of stock{:else if stockBadge.kind === 'low'}Only {stockBadge.count}
					left{:else}In stock{/if}
			</Text>
		</Cluster>

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
						<dt><Span color="secondary" size="sm">{spec.label}</Span></dt>
						<dd class="mt-0.5"><Span bold>{spec.value}</Span></dd>
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
				<Title level={2} size="md">About this product</Title>
				{#snippet paragraph(p: { heading: null | string; text: string })}
					<div class="mt-5">
						{#if p.heading}<Title level={3} size="sm">
								{p.heading}
							</Title>{/if}
						<Text class="whitespace-pre-line {p.heading ? 'mt-1' : ''}" color="secondary"
							>{p.text}</Text
						>
					</div>
				{/snippet}
				{#each text.paragraphs.slice(0, visible) as p, i (i)}
					{@render paragraph(p)}
				{/each}
				{#if visible < text.paragraphs.length}
					<details class="group mt-5">
						<summary
							class="cursor-pointer list-none text-[var(--primary-strong)] group-open:hidden"
						>
							<Span bold>Read more</Span>
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
				<Title level={2} size="md">Specifications</Title>
				<dl class="mt-5 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
					{#each text.specs as spec (spec.label)}
						<Cluster class="py-2.5" gap="md" justify="between" nowrap>
							<dt><Span color="secondary">{spec.label}</Span></dt>
							<dd class="text-right"><Span bold>{spec.value}</Span></dd>
						</Cluster>
					{/each}
				</dl>
			</div>
		{/if}
	</section>
{/if}

<Reviews reviews={data.reviews} />
