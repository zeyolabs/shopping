<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { BULK_DISPATCH_LIMIT, FILTER_LABELS, ORDER_FILTERS, type OrderFilter } from '../filters';
	import { dispatchOrders, getOrderCounts, getOrders, getReadyByService } from '../admin.remote';
	import { ErrorMessage } from '../../utils/errors';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import { Money } from '../../utils/money';
	import { SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';
	import { Packing } from '../library';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';

	const filter = $derived.by((): OrderFilter => {
		const value = page.url.searchParams.get('filter');
		return ORDER_FILTERS.find((f) => f === value) ?? 'to-ship';
	});
	const q = $derived(page.url.searchParams.get('q') ?? '');

	/** Orders ticked for bulk dispatch (only on the "Ready to dispatch" tab). */
	const selected = new SvelteSet<string>();
	let sendEmail = $state(true);
	let dispatching = $state(false);

	async function dispatchSelected(numbers: string[]) {
		if (
			sendEmail &&
			!confirm(
				`Dispatch ${numbers.length} order${numbers.length === 1 ? '' : 's'} and email the customer${numbers.length === 1 ? '' : 's'}?`
			)
		)
			return;
		dispatching = true;
		try {
			const results = await dispatchOrders({ numbers, sendEmail });
			const failed = results.filter((r) => !r.ok);
			const noEmail = results.filter((r) => r.ok && sendEmail && !r.emailed);
			selected.clear();
			if (failed.length === 0 && noEmail.length === 0) {
				toast.success(`Dispatched ${results.length} order${results.length === 1 ? '' : 's'}.`);
			} else {
				toast.warning(
					[
						`Dispatched ${results.length - failed.length} of ${results.length}.`,
						...failed.map((r) => `${r.number}: ${r.error}`),
						...(noEmail.length > 0
							? [
									`Email failed for ${noEmail.map((r) => r.number).join(', ')}: resend from the order page.`,
								]
							: []),
					].join(' ')
				);
			}
			await getOrders({ filter, q }).refresh();
		} catch (error) {
			toast.error(ErrorMessage.from(error, 'Could not dispatch the orders.'));
		} finally {
			dispatching = false;
		}
	}

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
	<Boundary message="Could not load ready counts.">
		{#each Object.entries(await getReadyByService()) as [service, n] (service)}
			<span class="text-sm text-[var(--muted)]">{service}: {n} ready</span>
		{/each}
	</Boundary>
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
	<!-- Only orders still on screen: a search or tab change must not dispatch hidden ticks. -->
	{let chosen = $derived(rows.map((r) => r.number).filter((n) => selected.has(n)))}
	{#if rows.length === 0}
		<p class="mt-6 text-[var(--ink-muted)]">
			{filter === 'to-ship' && !q ? 'Nothing to ship. All caught up.' : 'No orders match.'}
		</p>
	{:else}
		{#if filter === 'ready'}
			<div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
				<label class="flex items-center gap-2">
					<input
						checked={rows.length > 0 &&
							chosen.length === Math.min(rows.length, BULK_DISPATCH_LIMIT)}
						onchange={(event) => {
							selected.clear();
							if (event.currentTarget.checked)
								for (const r of rows.slice(0, BULK_DISPATCH_LIMIT)) selected.add(r.number);
						}}
						type="checkbox"
					/>
					Select {Math.min(rows.length, BULK_DISPATCH_LIMIT)}
				</label>
				<label class="flex items-center gap-2">
					<input bind:checked={sendEmail} type="checkbox" />
					Email the customers
				</label>
				<Button
					disabled={chosen.length === 0 || dispatching}
					onclick={() => dispatchSelected(chosen)}
				>
					Dispatch {chosen.length} order{chosen.length === 1 ? '' : 's'}
				</Button>
			</div>
		{/if}
		<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-[var(--line)] text-[var(--ink-muted)]">
					<tr>
						{#if filter === 'ready'}<th class="w-8 px-4 py-2"></th>{/if}
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
							{#if filter === 'ready'}
								<td class="px-4 py-2">
									<input
										aria-label="Select {row.number}"
										checked={selected.has(row.number)}
										disabled={!selected.has(row.number) && chosen.length >= BULK_DISPATCH_LIMIT}
										onchange={(event) => {
											if (event.currentTarget.checked) selected.add(row.number);
											else selected.delete(row.number);
										}}
										type="checkbox"
									/>
								</td>
							{/if}
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
