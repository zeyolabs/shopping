<script lang="ts">
	import { reviewForm } from '../remote/reviews.remote';
	import { ReviewSchema } from '../reviews.schema';
	import { Form, MessageField, SelectField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	let {
		name,
		number,
		productId,
		token,
	}: { name: string; number: string; productId: number; token: string } = $props();

	const form = $derived(reviewForm.for(productId));
	const RATINGS = [5, 4, 3, 2, 1] as const;
	const stars = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})`;
</script>

<Form class="mt-3 grid gap-3" {form} hidden={{ number, productId, token }} schema={ReviewSchema}>
	<SelectField
		name="rating"
		{form}
		getLabel={stars}
		items={RATINGS}
		label="Rating for {name}"
		placeholder="Choose a rating"
	/>
	<TextField name="title" {form} optional>Headline</TextField>
	<MessageField name="body" {form}>Your review</MessageField>
	<TextField name="name" autocomplete="given-name" {form}>Name to show</TextField>
	<div><Button {form}>Send review</Button></div>
</Form>
