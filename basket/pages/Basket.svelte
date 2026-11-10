<script lang="ts">
	import { resolve } from '$app/paths';
	import PageTitle from '../../ui/PageTitle.svelte';
	import { getBasket, getShippableCountries, setBasketQuantity, setShipTo } from '../client.remote';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import { toast } from 'svelte-sonner';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import { Select } from '@zeyolabs/ui/form/primitives';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';

	/** The app's own checkout remote function, which rate-limits before calling `createCheckout`. */
	let { startCheckout }: { startCheckout: () => Promise<{ url: string }> } = $props();

	const context = shopContext();
	let paying = $state(false);

	async function checkout() {
		paying = true;
		try {
			const { url } = await startCheckout();
			window.location.href = url;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not start checkout.');
			paying = false;
		}
	}
</script>

<PageTitle description="Your basket." title="Basket" />

<Boundary message="Could not load your basket.">
	{let [summary, countries] = $derived(await Promise.all([getBasket(), getShippableCountries()]))}

	{#if summary.lines.length === 0}
		<p>Your basket is empty.</p>
		<p class="mt-4"><a class="underline" href={resolve('/')}>Continue shopping</a></p>
	{:else}
		<ul class="divide-y divide-[var(--line)]">
			{#each summary.lines as line (line.id)}
				<li class="flex flex-wrap items-center gap-4 py-4">
					{#if line.cover}
						<img
							class="size-20 object-cover"
							alt={line.cover.alt || line.name}
							src={Images.url(context.imageBaseUrl, line.cover.src)}
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<a class="font-medium" href={resolve('/product/[slug]', { slug: line.slug })}>
							{line.name}
						</a>
						<p>{Money.format(line.pricePence)}</p>
						{#if line.available < line.quantity}
							<p class="text-sm text-[var(--danger)]">
								{line.available === 0 ? 'Out of stock' : `Only ${line.available} available`}
							</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<Button
							aria-label="Decrease quantity of {line.name}"
							icon
							onclick={() => setBasketQuantity({ productId: line.id, quantity: line.quantity - 1 })}
							size="sm"
							variant="secondary"
						>
							<Minus size={14} />
						</Button>
						<span class="w-6 text-center">{line.quantity}</span>
						<Button
							aria-label="Increase quantity of {line.name}"
							disabled={line.quantity >= line.limit}
							icon
							onclick={() => setBasketQuantity({ productId: line.id, quantity: line.quantity + 1 })}
							size="sm"
							variant="secondary"
						>
							<Plus size={14} />
						</Button>
					</div>
					<p class="w-20 text-right">{Money.format(line.lineTotalPence)}</p>
				</li>
			{/each}
		</ul>

		<div class="mt-6 ml-auto flex max-w-xs flex-col gap-1">
			<label class="form-label" for="ship-to">Deliver to</label>
			<Select
				id="ship-to"
				getKey={(country) => country.code}
				getLabel={(country) => country.name}
				getValue={(country) => country.code}
				items={countries}
				onchange={(code) => code && setShipTo({ country: code })}
				placeholder="Choose a country"
				value={summary.country}
			/>
		</div>

		<dl class="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1">
			<dt>Subtotal</dt>
			<dd class="text-right">{Money.format(summary.subtotalPence)}</dd>
			<dt>Delivery</dt>
			<dd class="text-right">
				{summary.shipping === null
					? '—'
					: summary.shippingPence === 0
						? 'Free'
						: Money.format(summary.shippingPence)}
			</dd>
			<dt class="font-medium">Total</dt>
			<dd class="text-right font-medium">{Money.format(summary.totalPence)}</dd>
		</dl>
		{#if summary.shipping === null}
			<p class="mt-2 text-right text-sm text-[var(--danger)]">
				We cannot ship this order to the selected country.
			</p>
		{:else}
			<p class="mt-2 text-right text-sm">
				{summary.shipping.name}, {summary.shipping.deliveryTime}.
			</p>
		{/if}
		{#if summary.domestic && summary.shippingPence > 0}
			<p class="mt-2 text-right text-sm">
				Free UK delivery on orders of {Money.format(summary.freeShippingFromPence)} or more.
			</p>
		{/if}

		<p class="mt-6 text-right">
			<Button
				disabled={!summary.shipping || summary.lines.some((line) => line.available < 1)}
				loading={paying}
				loadingMessage="Redirecting…"
				onclick={checkout}
				size="lg"
			>
				Checkout
			</Button>
		</p>
	{/if}

	{#snippet pending()}
		<SkeletonCard lines={4} />
	{/snippet}
</Boundary>
