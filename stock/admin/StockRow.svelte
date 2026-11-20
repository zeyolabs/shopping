<script lang="ts">
	import { Form, NumberField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';

	import { setStockForm } from '../admin.remote';
	import { StockSchema } from '../schema';

	let { id, name, stock }: { id: number; name: string; stock: number } = $props();

	const form = $derived(setStockForm.for(id));
</script>

<Form defaults={{ stock }} {form} hidden={{ productId: id }} reset={false} schema={StockSchema}>
	<Cluster gap="xs" justify="end" nowrap>
		<!-- The column header says "Stock"; the label names the product for screen readers. -->
		<NumberField name="stock" {form} inputmode="numeric">
			<Span class="sr-only">Stock for {name}</Span>
		</NumberField>
		<Button {form}>Save</Button>
	</Cluster>
</Form>
