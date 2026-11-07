<script lang="ts">
	import { setStockForm } from '../remote/admin-stock.remote';
	import { StockSchema } from './stock.schema';
	import { Form, NumberField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Span from '@zeyolabs/ui/text/Span.svelte';

	let { id, name, stock }: { id: number; name: string; stock: number } = $props();

	const form = $derived(setStockForm.for(id));
</script>

<Form
	class="flex items-end justify-end gap-2"
	defaults={{ stock }}
	{form}
	hidden={{ productId: id }}
	reset={false}
	schema={StockSchema}
>
	<!-- The column header says "Stock"; the label names the product for screen readers. -->
	<NumberField name="stock" {form} inputmode="numeric">
		<Span class="sr-only">Stock for {name}</Span>
	</NumberField>
	<Button {form}>Save</Button>
</Form>
