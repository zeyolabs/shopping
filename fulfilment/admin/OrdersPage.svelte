<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Head from '@zeyolabs/ui/head/Head.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';
	import { toast } from 'svelte-sonner';
	import { SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';

	import { ErrorMessage } from '../../utils/errors';
	import { Money } from '../../utils/money';
	import {
		dispatchOrders,
		getClickAndDropCsv,
		getFulfilmentMode,
		getOrderCounts,
		getOrders,
		getReadyByService,
	} from '../admin.remote';
	import { BULK_DISPATCH_LIMIT, FILTER_LABELS, ORDER_FILTERS, type OrderFilter } from '../filters';
	import { Packing } from '../library';

	const filter = $derived.by((): OrderFilter => {
		const value = page.url.searchParams.get('filter');
		return ORDER_FILTERS.find((f) => f === value) ?? 'to-ship';
	});
	const q = $derived(page.url.searchParams.get('q') ?? '');

	/** Orders ticked for bulk dispatch (only on the "Ready to dispatch" tab). */
	const selected = new SvelteSet<string>();
	let sendEmail = $state(true);
	let dispatching = $state(false);

	async function downloadCsv(numbers: string[]) {
		try {
			const csv = await getClickAndDropCsv({ numbers });
			const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = `click-and-drop-${new Date().toISOString().slice(0, 10)}.csv`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(ErrorMessage.from(error, 'Could not create the CSV.'));
		}
	}

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

<Head title="Orders" />

<Title level={1} size="md">Orders</Title>

<nav class="mt-4" aria-label="Order filter">
	<Cluster gap="xs">
		{#each ORDER_FILTERS as f (f)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves the path -->
			<a
				class="rounded-full border px-3 py-1 no-underline {f === filter
					? 'border-[var(--acc)] bg-[var(--acc)] text-white'
					: 'border-[var(--bd)] bg-white text-[var(--tx)]'}"
				aria-current={f === filter ? 'page' : undefined}
				href={href({ filter: f })}
			>
				<Span size="sm">{FILTER_LABELS[f]} ({(await getOrderCounts())[f]})</Span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
		<Boundary message="Could not load ready counts.">
			{#each Object.entries(await getReadyByService()) as [service, n] (service)}
				<Span color="secondary">{service}: {n} ready</Span>
			{/each}

			{#snippet pending()}{/snippet}
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
				class="w-56 rounded-md border border-[var(--bd)] px-3 py-1.5"
				placeholder="Order, email or name"
				type="search"
				value={q}
			/>
		</form>
	</Cluster>
</nav>

<Boundary message="Could not load orders.">
	{let rows = $derived(await getOrders({ filter, q }))}
	<!-- Only orders still on screen: a search or tab change must not dispatch hidden ticks. -->
	{let chosen = $derived(rows.map((r) => r.number).filter((n) => selected.has(n)))}
	{#if rows.length === 0}
		<Text class="mt-6" color="secondary">
			{filter === 'to-ship' && !q ? 'Nothing to ship. All caught up.' : 'No orders match.'}
		</Text>
	{:else}
		{#if filter === 'ready'}
			<Cluster class="mt-4" gap="md">
				<Cluster gap="xs" nowrap>
					<input
						id="select-ready"
						checked={rows.length > 0 &&
							chosen.length === Math.min(rows.length, BULK_DISPATCH_LIMIT)}
						onchange={(event) => {
							selected.clear();
							if (event.currentTarget.checked)
								for (const r of rows.slice(0, BULK_DISPATCH_LIMIT)) selected.add(r.number);
						}}
						type="checkbox"
					/>
					<label for="select-ready"
						><Span size="sm">Select {Math.min(rows.length, BULK_DISPATCH_LIMIT)}</Span></label
					>
				</Cluster>
				<Cluster gap="xs" nowrap>
					<input id="email-customers" type="checkbox" bind:checked={sendEmail} />
					<label for="email-customers"><Span size="sm">Email the customers</Span></label>
				</Cluster>
				<Button
					disabled={chosen.length === 0 || dispatching}
					onclick={() => dispatchSelected(chosen)}
				>
					Dispatch {chosen.length} order{chosen.length === 1 ? '' : 's'}
				</Button>
				{#if (await getFulfilmentMode()) === 'manual'}
					<Button
						disabled={chosen.length === 0}
						onclick={() => downloadCsv(chosen)}
						variant="secondary"
					>
						Download CSV for Click &amp; Drop
					</Button>
				{/if}
			</Cluster>
		{/if}
		<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--bd)] bg-white">
			<table class="w-full text-left">
				<thead class="border-b border-[var(--bd)] text-[var(--txs)]">
					<tr>
						{#if filter === 'ready'}<th class="w-8 px-4 py-2"></th>{/if}
						<th class="px-4 py-2"><Span bold size="sm">Order</Span></th>
						<th class="px-4 py-2"><Span bold size="sm">Placed</Span></th>
						<th class="px-4 py-2"><Span bold size="sm">Customer</Span></th>
						<th class="px-4 py-2 text-right"><Span bold size="sm">Total</Span></th>
						<th class="px-4 py-2"><Span bold size="sm">Status</Span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--bd)]">
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
							<td class="px-4 py-2">
								<a href={resolve('/orders/[number]', { number: row.number })}
									><Span bold size="sm">{row.number}</Span></a
								>
							</td>
							<td class="px-4 py-2 whitespace-nowrap"
								><Span size="sm">{date.format(row.createdAt)}</Span></td
							>
							<td class="px-4 py-2">
								<Span size="sm">{row.name}</Span>
								<Span class="block" color="secondary" size="xs">{row.email} · {row.country}</Span>
							</td>
							<td class="px-4 py-2 text-right whitespace-nowrap"
								><Span size="sm">{Money.format(row.totalPence)}</Span></td
							>
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
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
