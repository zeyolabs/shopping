<script lang="ts">
	import { page } from '$app/state';
	import PageTitle from '../components/PageTitle.svelte';
	import { getOrderPage } from '../remote/order.remote';
	import { shoppingClient } from '../client';
	import { formatMoney } from '../money';
	import { trackingUrl } from '../order-links';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';

	const client = shoppingClient();
	const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Europe/London' });
</script>

<PageTitle description="Check the status of your order." title="Your order" />

<svelte:head>
	<meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<Boundary message="Could not load this order." statusMessages={{ 404: 'Order not found.' }}>
	{let data = $derived(
		await getOrderPage({ number: page.params.number ?? '', token: page.params.token ?? '' })
	)}
	{let order = $derived(data.order)}
	{let cancelled = $derived(order.status === 'cancelled' || order.status === 'refunded')}
	{let tracking = $derived(order.trackingNumber ? trackingUrl(order.trackingNumber) : null)}
	{let steps = $derived([
		{ done: true, label: 'Order placed', when: order.paidAt ?? order.createdAt },
		{ done: order.shippedAt !== null, label: 'Dispatched', when: order.shippedAt },
	])}

	<p class="text-[var(--txs)]">Order <strong class="text-[var(--tx)]">{order.number}</strong></p>

	{#if cancelled}
		<p class="mt-4 rounded-2xl border border-[var(--bd)] p-4">
			This order was {order.status}. Email
			<a class="underline" href="mailto:{client.supportEmail}">{client.supportEmail}</a> if you have any
			questions.
		</p>
	{:else}
		<ol class="mt-6 space-y-3">
			{#each steps as step (step.label)}
				<li class="flex items-center gap-3">
					<span
						class="grid size-6 place-items-center rounded-full text-xs {step.done
							? 'bg-[var(--primary-strong)] text-white'
							: 'border border-[var(--bd)] text-[var(--txs)]'}"
						aria-hidden="true">{step.done ? '✓' : ''}</span
					>
					<span class={step.done ? 'font-medium' : 'text-[var(--txs)]'}>
						{step.label}{step.done && step.when ? `: ${date.format(step.when)}` : ''}
					</span>
				</li>
			{/each}
		</ol>

		{#if order.shippedAt && tracking}
			<p class="mt-4">
				Tracking number:
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Royal Mail URL -->
				<a class="underline" href={tracking} rel="noopener" target="_blank"
					>{order.trackingNumber}</a
				>
			</p>
		{:else if order.shippedAt}
			<p class="mt-4 text-[var(--txs)]">This parcel is sent untracked.</p>
		{:else}
			<p class="mt-4 text-[var(--txs)]">
				We will dispatch your order soon. This page updates as soon as it is on its way.
			</p>
		{/if}
	{/if}

	<h2 class="mt-8 text-lg font-semibold">Items</h2>
	<ul class="mt-2 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
		{#each data.items as item (item.name)}
			<li class="flex justify-between gap-4 py-3">
				<span>{item.name} <span class="text-[var(--txs)]">× {item.quantity}</span></span>
				<span>{formatMoney(item.quantity * item.unitPricePence)}</span>
			</li>
		{/each}
	</ul>

	<dl class="mt-3 ml-auto max-w-xs space-y-1">
		<div class="flex justify-between">
			<dt>Subtotal</dt>
			<dd>{formatMoney(order.subtotalPence)}</dd>
		</div>
		{#if order.discountPence > 0}
			<div class="flex justify-between">
				<dt>Discount</dt>
				<dd>-{formatMoney(order.discountPence)}</dd>
			</div>
		{/if}
		<div class="flex justify-between">
			<dt>Delivery</dt>
			<dd>{order.shippingPence === 0 ? 'Free' : formatMoney(order.shippingPence)}</dd>
		</div>
		<div class="flex justify-between font-semibold">
			<dt>Total</dt>
			<dd>{formatMoney(order.totalPence)}</dd>
		</div>
	</dl>

	<h2 class="mt-8 text-lg font-semibold">Delivering to</h2>
	<address class="mt-2 not-italic">
		{data.address.name}<br />
		{data.address.line1}<br />
		{#if data.address.line2}{data.address.line2}<br />{/if}
		{data.address.city}<br />
		{data.address.postcode}<br />
		{data.address.country}
	</address>

	<p class="mt-8 text-[var(--txs)]">
		Need help? Email <a class="underline" href="mailto:{client.supportEmail}"
			>{client.supportEmail}</a
		>, quoting {order.number}.
	</p>

	{#snippet pending()}
		<SkeletonCard lines={4} />
	{/snippet}
</Boundary>
