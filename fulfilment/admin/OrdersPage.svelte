<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { FILTER_LABELS, ORDER_FILTERS, type OrderFilter } from '../filters';
	import { getOrderCounts, getOrders } from '../admin.remote';
	import { Money } from '../../utils/money';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Packing } from '../library';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';

	const filter = $derived.by((): OrderFilter => {
		const value = page.url.searchParams.get('filter');
		return ORDER_FILTERS.find((f) => f === value) ?? 'to-ship';
	});
	const q = $derived(page.url.searchParams.get('q') ?? '');

	const date = new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/London',
	});

	function href(next: { filter?: OrderFilter; q?: string }) {
		const params = new SvelteURLSearchParams();
		const f = next.filter ?? filter;
		const query = next.q ?? q;
		if (f !== 'to-ship') params.set('filter', f);
		if (query) params.set('q', query);
		const search = params.toString();
		return `${resolve('/orders')}${search ? `?${search}` : ''}`;
	}
</script>

<svelte:head><title>Orders · Admin</title></svelte:head>

<h1 class="text-2xl font-semibold">Orders</h1>

<nav class="mt-4 flex flex-wrap items-center gap-2" aria-label="Order filter">
	{#each ORDER_FILTERS as f (f)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves the path -->
		<a
			class="rounded-full border px-3 py-1 text-sm no-underline {f === filter
				? 'border-[var(--leaf-dark)] bg-[var(--leaf-dark)] text-white'
				: 'border-[var(--line)] bg-white text-[var(--ink)]'}"
			aria-current={f === filter ? 'page' : undefined}
			href={href({ filter: f })}
		>
			{FILTER_LABELS[f]}
			({(await getOrderCounts())[f]})
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
	<form
		class="ml-auto"
		onsubmit={(event) => {
			event.preventDefault();
			const input = new FormData(event.currentTarget).get('q');
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- href() already resolves the path
			goto(href({ q: typeof input === 'string' ? input.trim() : '' }));
		}}
	>
		<input
			name="q"
			class="w-56 rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
			placeholder="Order, email or name"
			type="search"
			value={q}
		/>
	</form>
</nav>

<Boundary message="Could not load orders.">
	{let rows = $derived(await getOrders({ filter, q }))}
	{#if rows.length === 0}
		<p class="mt-6 text-[var(--ink-muted)]">
			{filter === 'to-ship' && !q ? 'Nothing to ship. All caught up.' : 'No orders match.'}
		</p>
	{:else}
		<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-[var(--line)] text-[var(--ink-muted)]">
					<tr>
						<th class="px-4 py-2 font-medium">Order</th>
						<th class="px-4 py-2 font-medium">Placed</th>
						<th class="px-4 py-2 font-medium">Customer</th>
						<th class="px-4 py-2 text-right font-medium">Total</th>
						<th class="px-4 py-2 font-medium">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--line)]">
					{#each rows as row (row.number)}
						<tr>
							<td class="px-4 py-2 font-medium">
								<a href={resolve('/orders/[number]', { number: row.number })}>{row.number}</a>
							</td>
							<td class="px-4 py-2 whitespace-nowrap">{date.format(row.createdAt)}</td>
							<td class="px-4 py-2">
								{row.name}
								<span class="block text-xs text-[var(--ink-muted)]"
									>{row.email} · {row.country}</span
								>
							</td>
							<td class="px-4 py-2 text-right whitespace-nowrap">{Money.format(row.totalPence)}</td>
							<td class="px-4 py-2">
								{#if row.status === 'paid' || row.status === 'shipped'}
									{let stage = $derived(Packing.stage(row))}
									<Badge color={Packing.STAGE_COLORS[stage]}>{Packing.STAGE_LABELS[stage]}</Badge>
								{:else}
									<Badge color="neutral">{row.status}</Badge>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
