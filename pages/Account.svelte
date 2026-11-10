<script lang="ts">
	import type { Snippet } from 'svelte';

	import PageTitle from '../components/PageTitle.svelte';
	import { getMyOrders } from '../remote/account.remote';
	import { formatMoney } from '../money';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import SkeletonCard from '@zeyolabs/ui/skeleton/SkeletonCard.svelte';

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

<PageTitle description="Your orders." title="Your account" />

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Boundary message="Could not load your orders.">
	{let data = $derived(await getMyOrders())}
	<p class="text-[var(--txs)]">
		Signed in as <strong class="text-[var(--tx)]">{data.email}</strong>
	</p>

	<h2 class="mt-8 text-lg font-semibold">Orders</h2>
	{#if data.orders.length === 0}
		<p class="mt-2 text-[var(--txs)]">
			No orders yet. Orders placed with this email address, signed in or not, show here.
		</p>
	{:else}
		<ul class="mt-2 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
			{#each data.orders as order (order.number)}
				<li class="flex flex-wrap items-center justify-between gap-2 py-3">
					<span>
						{#if order.path}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the order's private path -->
							<a class="font-medium underline" href={order.path}>{order.number}</a>
						{:else}
							<span class="font-medium">{order.number}</span>
						{/if}
						<span class="text-[var(--txs)]"> · {date.format(order.createdAt)}</span>
					</span>
					<span>
						<span class="text-[var(--txs)]">{STATUS[order.status] ?? order.status}</span>
						· {formatMoney(order.totalPence)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet pending()}
		<SkeletonCard lines={3} />
	{/snippet}
</Boundary>

{@render children?.()}
