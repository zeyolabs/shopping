<script lang="ts">
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import { getStock } from '../admin.remote';
	import StockRow from './StockRow.svelte';
</script>

<svelte:head><title>Stock</title></svelte:head>

<Title level={1} size="md">Stock</Title>
<Text class="mt-1" color="secondary">
	Setting a sold-out product above 0 emails the customers waiting for it, up to 50 a minute, and
	removes them from the list.
</Text>

<Boundary message="Could not load stock.">
	{let rows = $derived(await getStock())}
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--bd)] bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-[var(--bd)] text-[var(--txs)]">
				<tr>
					<th class="px-4 py-2 font-medium">Product</th>
					<th class="px-4 py-2 font-medium">SKU</th>
					<th class="px-4 py-2 text-right font-medium">Waiting</th>
					<th class="px-4 py-2 text-right font-medium">Stock</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--bd)]">
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
		<Text class="mt-6" color="secondary">Loading…</Text>
	{/snippet}
</Boundary>
