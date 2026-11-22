<script lang="ts">
	import type { Snippet } from 'svelte';

	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { Money } from '../../utils/money';
	import { getMyOrders } from '../client.remote';

	let {
		children,
	}: {
		/** Anything the app adds below the orders, e.g. passkeys and signing out. */
		children?: Snippet;
	} = $props();

	const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' });
	const STATUS: Record<string, string> = {
		cancelled: 'Cancelled',
		paid: 'Being prepared',
		pending: 'Awaiting payment',
		refunded: 'Refunded',
		shipped: 'Dispatched',
	};
</script>

<Head description="Your orders." title="Your account" />
<Title class="mb-10 text-[var(--primary-strong)]" level={1}>Your account</Title>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Boundary message="Could not load your orders.">
	{let data = $derived(await getMyOrders())}
	<Text color="secondary">
		Signed in as <strong class="text-[var(--tx)]">{data.email}</strong>
	</Text>

	<Title class="mt-8" level={2} size="sm">Orders</Title>
	{#if data.orders.length === 0}
		<Text class="mt-2" color="secondary">
			No orders yet. Orders placed with this email address, signed in or not, show here.
		</Text>
	{:else}
		<ul class="mt-2 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
			{#each data.orders as order (order.number)}
				<li class="py-3">
					<Cluster gap="xs" justify="between">
						<Span>
							{#if order.path}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the order's private path -->
								<a class="underline" href={order.path}><Span bold>{order.number}</Span></a>
							{:else}
								<Span bold>{order.number}</Span>
							{/if}
							<Span color="secondary">· {date.format(order.createdAt)}</Span>
						</Span>
						<Span>
							<Span color="secondary">{STATUS[order.status] ?? order.status}</Span>
							· {Money.format(order.totalPence)}
						</Span>
					</Cluster>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet pending()}
		<SkeletonCard lines={3} />
	{/snippet}
</Boundary>

{@render children?.()}
