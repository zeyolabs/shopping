<script lang="ts">
	import { Form, MessageField, NumberField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';

	import { saveCategoryForm } from '../admin.remote';
	import { CategoryFormSchema } from '../schema';

	type Category = {
		description: string;
		id: number;
		name: string;
		slug: string;
		sortOrder: number;
	};

	let {
		category,
		onDone,
	}: {
		/** The category to edit; null for a new one. */
		category: Category | null;
		onDone: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const form = saveCategoryForm.for(category?.id ?? 'new');
</script>

<Form
	class="grid max-w-xl gap-3 rounded-xl border border-[var(--bd)] bg-white p-5"
	defaults={{
		description: category?.description ?? '',
		name: category?.name ?? '',
		slug: category?.slug ?? '',
		sortOrder: category?.sortOrder ?? 0,
	}}
	{form}
	hidden={{ id: category?.id }}
	onSuccess={onDone}
	reset={false}
	schema={CategoryFormSchema}
>
	<TextField name="name" {form}>Name</TextField>
	<TextField name="slug" {form} optional placeholder="made from the name">Slug (URL)</TextField>
	<MessageField name="description" {form} optional>Description</MessageField>
	<NumberField name="sortOrder" {form} inputmode="numeric">Sort order</NumberField>
	<Cluster gap="sm">
		<Button {form}>Save</Button>
		<Button onclick={onDone} variant="secondary">Cancel</Button>
	</Cluster>
</Form>
