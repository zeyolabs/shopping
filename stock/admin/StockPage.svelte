<script lang="ts">
	import { getStock } from '../admin.remote';
	import StockRow from './StockRow.svelte';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
</script>

<svelte:head><title>Stock</title></svelte:head>

<h1 class="text-2xl font-semibold">Stock</h1>
<p class="mt-1 text-sm text-[var(--ink-muted)]">
	Setting a sold-out product above 0 emails the customers waiting for it, up to 50 a minute, and
	removes them from the list.
</p>

<Boundary message="Could not load stock.">
	{let rows = $derived(await getStock())}
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-[var(--line)] text-[var(--ink-muted)]">
				<tr>
					<th class="px-4 py-2 font-medium">Product</th>
					<th class="px-4 py-2 font-medium">SKU</th>
					<th class="px-4 py-2 text-right font-medium">Waiting</th>
					<th class="px-4 py-2 text-right font-medium">Stock</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--line)]">
				{#each rows as row (row.id)}
					<tr>
						<td class="px-4 py-2 font-medium">
							{row.name}{row.variationLabel ? ` · ${row.variationLabel}` : ''}
							{#if !row.active}<Badge color="neutral">inactive</Badge>{/if}
						</td>
						<td class="px-4 py-2 whitespace-nowrap">{row.sku}</td>
						<td class="px-4 py-2 text-right">{row.waiting}</td>
						<td class="px-4 py-2"
							><StockRow
								id={row.id}
								name={`${row.name}${row.variationLabel ? ` ${row.variationLabel}` : ''} (${row.sku})`}
								stock={row.stock}
							/></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
