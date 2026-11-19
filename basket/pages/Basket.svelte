<script lang="ts">
	import { resolve } from '$app/paths';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import { Form } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import { Select } from '@zeyolabs/ui/form/primitives';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import { toast } from 'svelte-sonner';

	import { shopContext } from '../../context';
	import PageTitle from '../../ui/PageTitle.svelte';
	import { ErrorMessage } from '../../utils/errors';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import {
		basketQuantityForm,
		getBasket,
		getShippableCountries,
		removeBundleFromBasket,
		setShipTo,
	} from '../client.remote';
	import { BasketQuantitySchema } from '../schema';

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
			toast.error(ErrorMessage.from(error, 'Could not start checkout.'));
			paying = false;
		}
	}
</script>

<PageTitle description="Your basket." title="Basket" />

<Boundary message="Could not load your basket.">
	{let [summary, countries] = $derived(await Promise.all([getBasket(), getShippableCountries()]))}

	{#if summary.lines.length === 0 && summary.bundles.length === 0}
		<Text>Your basket is empty.</Text>
		<Text class="mt-4"><a class="underline" href={resolve('/')}>Continue shopping</a></Text>
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
						<Text>{Money.format(line.pricePence)}</Text>
						{#if line.available < line.quantity}
							<Text class="text-[var(--danger)]">
								{line.available === 0 ? 'Out of stock' : `Only ${line.available} available`}
							</Text>
						{/if}
					</div>
					{const form = basketQuantityForm.for(line.id)}
					<Form
						class="flex items-center gap-2"
						{form}
						hidden={{ productId: line.id }}
						reset={false}
						schema={BasketQuantitySchema}
					>
						<Button
							{...form.fields.quantity.as('submit', line.quantity - 1)}
							aria-label="Decrease quantity of {line.name}"
							{form}
							icon
							size="sm"
							variant="secondary"
						>
							<Minus size={14} />
						</Button>
						<Span class="w-6" centered>{line.quantity}</Span>
						<Button
							{...form.fields.quantity.as('submit', line.quantity + 1)}
							aria-label="Increase quantity of {line.name}"
							disabled={line.quantity >= line.limit}
							{form}
							icon
							size="sm"
							variant="secondary"
						>
							<Plus size={14} />
						</Button>
					</Form>
					<Text class="w-20 text-right">{Money.format(line.lineTotalPence)}</Text>
				</li>
			{/each}
			{#each summary.bundles as bundle (bundle.index)}
				<li class="flex flex-wrap items-start gap-4 py-4">
					{#if bundle.cover}
						<img
							class="size-20 object-cover"
							alt={bundle.cover.alt || bundle.name}
							src={Images.url(context.imageBaseUrl, bundle.cover.src)}
						/>
					{/if}
					<div class="min-w-0 flex-1">
						{#if bundle.slug}
							<a class="font-medium" href={resolve('/bundle/[slug]', { slug: bundle.slug })}>
								{bundle.name}
							</a>
						{:else}
							<Text bold>{bundle.name}</Text>
						{/if}
						{#if bundle.details.length > 0}
							<ul class="mt-1 text-sm text-[var(--txs)]">
								{#each bundle.details as detail, i (i)}<li>{detail}</li>{/each}
							</ul>
						{/if}
						{#if bundle.problem}
							<Text class="mt-1 text-[var(--danger)]">{bundle.problem}</Text>
						{/if}
					</div>
					<Button
						aria-label="Remove {bundle.name}"
						icon
						onclick={() => removeBundleFromBasket({ index: bundle.index })}
						size="sm"
						variant="secondary"
					>
						<Trash size={14} />
					</Button>
					<Text class="w-20 text-right">
						{Money.format(bundle.pricePence)}
						{#if bundle.listPricePence > bundle.pricePence}
							<s class="block text-xs text-[var(--txt)]">{Money.format(bundle.listPricePence)}</s>
						{/if}
					</Text>
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
			<Text class="mt-2 text-right text-[var(--danger)]">
				We cannot ship this order to the selected country.
			</Text>
		{:else}
			<Text class="mt-2 text-right">
				{summary.shipping.name}, {summary.shipping.deliveryTime}.
			</Text>
		{/if}
		{#if summary.domestic && summary.shippingPence > 0}
			<Text class="mt-2 text-right">
				Free UK delivery on orders of {Money.format(summary.freeShippingFromPence)} or more.
			</Text>
		{/if}

		<Text class="mt-6 text-right">
			<Button
				disabled={!summary.shipping ||
					summary.lines.some((line) => line.available < 1) ||
					summary.bundles.some((bundle) => !bundle.available)}
				loading={paying}
				loadingMessage="Redirecting…"
				onclick={checkout}
				size="lg"
			>
				Checkout
			</Button>
		</Text>
	{/if}

	{#snippet pending()}
		<SkeletonCard lines={4} />
	{/snippet}
</Boundary>
