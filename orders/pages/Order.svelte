<script lang="ts">
	import { page } from '$app/state';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { shopContext } from '../../context';
	import { getOrderReviews } from '../../reviews/client.remote';
	import ReviewForm from '../../reviews/components/ReviewForm.svelte';
	import PageTitle from '../../ui/PageTitle.svelte';
	import { Money } from '../../utils/money';
	import { getOrderPage } from '../client.remote';
	import { Orders } from '../library';

	const context = shopContext();
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
	{let tracking = $derived(order.trackingNumber ? Orders.trackingUrl(order.trackingNumber) : null)}
	{let steps = $derived([
		{ done: true, label: 'Order placed', when: order.paidAt ?? order.createdAt },
		{ done: order.shippedAt !== null, label: 'Dispatched', when: order.shippedAt },
	])}

	<Text color="secondary">Order <strong class="text-[var(--tx)]">{order.number}</strong></Text>

	{#if cancelled}
		<Text class="mt-4 rounded-2xl border border-[var(--bd)] p-4">
			This order was {order.status}. Email
			<a class="underline" href="mailto:{context.supportEmail}">{context.supportEmail}</a> if you have
			any questions.
		</Text>
	{:else}
		<ol class="mt-6 space-y-3">
			{#each steps as step (step.label)}
				<li class="flex items-center gap-3">
					<div
						class="grid size-6 place-items-center rounded-full text-xs {step.done
							? 'bg-[var(--primary-strong)] text-white'
							: 'border border-[var(--bd)] text-[var(--txs)]'}"
						aria-hidden="true"
					>
						{step.done ? '✓' : ''}
					</div>
					<Span bold={step.done} color={step.done ? undefined : 'secondary'}>
						{step.label}{step.done && step.when ? `: ${date.format(step.when)}` : ''}
					</Span>
				</li>
			{/each}
		</ol>

		{#if order.shippedAt && tracking}
			<Text class="mt-4">
				Tracking number:
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Royal Mail URL -->
				<a class="underline" href={tracking} rel="noopener" target="_blank"
					>{order.trackingNumber}</a
				>
			</Text>
		{:else if order.shippedAt}
			<Text class="mt-4" color="secondary">This parcel is sent untracked.</Text>
		{:else}
			<Text class="mt-4" color="secondary">
				We will dispatch your order soon. This page updates as soon as it is on its way.
			</Text>
		{/if}
	{/if}

	<Title class="mt-8" level={2} size="sm">Items</Title>
	<ul class="mt-2 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
		{#each data.items as item (item.name)}
			<li class="flex justify-between gap-4 py-3">
				<Span>{item.name} <Span color="secondary">× {item.quantity}</Span></Span>
				<Span>{Money.format(item.quantity * item.unitPricePence)}</Span>
			</li>
		{/each}
	</ul>

	<dl class="mt-3 ml-auto max-w-xs space-y-1">
		<div class="flex justify-between">
			<dt>Subtotal</dt>
			<dd>{Money.format(order.subtotalPence)}</dd>
		</div>
		{#if order.discountPence > 0}
			<div class="flex justify-between">
				<dt>Discount</dt>
				<dd>-{Money.format(order.discountPence)}</dd>
			</div>
		{/if}
		<div class="flex justify-between">
			<dt>Delivery</dt>
			<dd>{order.shippingPence === 0 ? 'Free' : Money.format(order.shippingPence)}</dd>
		</div>
		<div class="flex justify-between font-semibold">
			<dt>Total</dt>
			<dd>{Money.format(order.totalPence)}</dd>
		</div>
	</dl>

	{#if order.hasInvoice}
		<Text class="mt-3 text-right">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- server route, opens Stripe's PDF -->
			<a class="underline" href="{page.url.pathname}/invoice" rel="external"
				>Download invoice (PDF)</a
			>
		</Text>
	{/if}

	<Title class="mt-8" level={2} size="sm">Delivering to</Title>
	<address class="mt-2 not-italic">
		{data.address.name}<br />
		{data.address.line1}<br />
		{#if data.address.line2}{data.address.line2}<br />{/if}
		{data.address.city}<br />
		{data.address.postcode}<br />
		{data.address.country}
	</address>

	{let reviewable = $derived(
		await getOrderReviews({ number: order.number, token: page.params.token ?? '' })
	)}
	{#if reviewable.items.length > 0}
		<Title class="mt-8" level={2} size="sm">Review your items</Title>
		<ul class="mt-2 space-y-6">
			{#each reviewable.items as item (item.productId)}
				<li class="rounded-2xl border border-[var(--bd)] p-4">
					<Text bold>{item.name}</Text>
					{#if item.review}
						<Text class="mt-1" color="secondary">
							Reviewed, {item.review.rating} of 5.
							{item.review.status === 'pending'
								? 'It will appear once we have checked it.'
								: item.review.status === 'approved'
									? 'It is on the product page.'
									: ''}
						</Text>
					{:else}
						<ReviewForm
							name={item.name}
							number={order.number}
							productId={item.productId}
							token={page.params.token ?? ''}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<Text class="mt-8" color="secondary">
		Need help? Email <a class="underline" href="mailto:{context.supportEmail}"
			>{context.supportEmail}</a
		>, quoting {order.number}.
	</Text>

	{#snippet pending()}
		<SkeletonCard lines={4} />
	{/snippet}
</Boundary>
