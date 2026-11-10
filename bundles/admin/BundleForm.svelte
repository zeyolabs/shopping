<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { getAdminBundle } from '../admin.remote';
	import { saveBundleForm } from '../admin.remote';
	import { BundleFormSchema } from '../schema';
	import { shopContext } from '../../context';
	import { CheckboxField, Form, MessageField, NumberField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	type Bundle = Awaited<ReturnType<typeof getAdminBundle>>;

	let { bundle }: { bundle: Bundle | null } = $props();

	const context = shopContext();
	// The page re-creates this component per bundle ({#key}), so reading the prop once is right.
	// svelte-ignore state_referenced_locally
	const b = bundle;
	const form = saveBundleForm.for(b?.id ?? 'new');
	const { steps } = form.fields;
	const stepRows = $derived(steps.value() ?? []);
	const newStep = { description: '', maxChoices: 1, minChoices: 1, skus: '', title: '' };

	const input = 'mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-1.5';
	const section = 'grid gap-4 rounded-xl border border-[var(--line)] bg-white p-5';
</script>

<Form
	class="grid max-w-3xl gap-6"
	defaults={{
		active: b?.active ?? false,
		description: b?.description ?? '',
		image: b?.image ?? '',
		name: b?.name ?? '',
		slug: b?.slug ?? '',
		sortOrder: b?.sortOrder ?? 0,
		steps: b?.steps.map((s) => ({ ...s, skus: s.skus.join('\n') })) ?? [newStep],
	}}
	{form}
	hidden={{ id: b?.id }}
	onSuccess={(data) => {
		if (!b) goto(resolve('/bundles/[id]', { id: String(data.id) }));
	}}
	reset={false}
	schema={BundleFormSchema}
>
	<section class={section}>
		<TextField name="name" {form}>Name</TextField>
		<div class="grid gap-4 sm:grid-cols-2">
			<TextField name="slug" {form} optional placeholder="made from the name">Slug (URL)</TextField>
			<TextField name="image" {form} optional>Image file name</TextField>
		</div>
		<MessageField name="description" {form} optional>Description</MessageField>
		<div class="grid gap-4 sm:grid-cols-2">
			<NumberField name="sortOrder" {form} inputmode="numeric">Sort order</NumberField>
			<CheckboxField name="active" {form}>On sale in the shop</CheckboxField>
		</div>
	</section>

	{#each stepRows as _, i (i)}
		<section class={section}>
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">Step {i + 1}</h2>
				{#if stepRows.length > 1}
					<Button
						onclick={() => steps.set(stepRows.filter((_, j) => j !== i))}
						size="sm"
						variant="secondary">Remove step</Button
					>
				{/if}
			</div>
			<label class="text-sm font-medium">
				Title, e.g. "Choose your switches"
				<input {...steps[i].title.as('text')} class={input} />
			</label>
			<label class="text-sm font-medium">
				Help text (optional)
				<input {...steps[i].description.as('text')} class={input} />
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="text-sm font-medium">
					Fewest picks (0 = optional)
					<input {...steps[i].minChoices.as('number')} class={input} min="0" />
				</label>
				<label class="text-sm font-medium">
					Most picks
					<input {...steps[i].maxChoices.as('number')} class={input} min="1" />
				</label>
			</div>
			<label class="text-sm font-medium">
				Products offered, one SKU per line
				<textarea {...steps[i].skus.as('text')} class="{input} min-h-28 font-mono"></textarea>
			</label>
		</section>
	{/each}
	<div>
		<Button onclick={() => steps.set([...stepRows, newStep])} variant="secondary">Add step</Button>
	</div>

	<div class="flex items-center gap-4">
		<Button {form} loadingMessage="Saving…">Save bundle</Button>
		{#if b?.active}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
			<a href="{context.siteUrl}/bundle/{b.slug}" rel="noopener" target="_blank">View in shop</a>
		{/if}
	</div>
</Form>
