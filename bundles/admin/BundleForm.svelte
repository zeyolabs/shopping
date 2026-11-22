<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { CheckboxField, Form, MessageField, NumberField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';
	import Cluster from '@zeyolabs/ui/layout/Cluster.svelte';
	import Grid from '@zeyolabs/ui/layout/Grid.svelte';
	import Title from '@zeyolabs/ui/text/Title.svelte';

	import type { getAdminBundle } from '../admin.remote';

	import { shopContext } from '../../context';
	import { saveBundleForm } from '../admin.remote';
	import { BundleFormSchema } from '../schema';

	type Bundle = Awaited<ReturnType<typeof getAdminBundle>>;

	let { bundle }: { bundle: Bundle | null } = $props();

	const context = shopContext();
	// The page re-creates this component per bundle ({#key}), so reading the prop once is right.
	// svelte-ignore state_referenced_locally
	const b = bundle;
	const form = saveBundleForm.for(b?.id ?? 'new');
	const { steps } = form.fields;
	const stepRows = $derived(steps.value() ?? []);
	const newStep = {
		description: '',
		maxChoices: 1,
		maxPerChoice: '',
		minChoices: 1,
		role: 'pick' as const,
		skus: '',
		title: '',
	};
	const ROLES = [
		{ label: 'Pick products', value: 'pick' },
		{ label: 'Kit base (sets price and slots)', value: 'base' },
		{ label: 'Kit fill (one per slot)', value: 'fill' },
		{ label: 'Kit cover (one product for every slot)', value: 'cover' },
	] as const;

	const input = 'mt-1 w-full rounded-md border border-[var(--bd)] bg-white px-3 py-1.5';
	const section = 'grid gap-4 rounded-xl border border-[var(--bd)] bg-white p-5';
</script>

<Form
	class="grid max-w-3xl gap-6"
	defaults={{
		active: b?.active ?? false,
		description: b?.description ?? '',
		discountPercent: b?.discountPercent ?? 0,
		image: b?.image ?? '',
		name: b?.name ?? '',
		slug: b?.slug ?? '',
		sortOrder: b?.sortOrder ?? 0,
		steps: b?.steps.map((s) => ({
			...s,
			maxPerChoice: s.maxPerChoice ? String(s.maxPerChoice) : '',
			skus: s.skus.join('\n'),
		})) ?? [newStep],
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
		<Grid columns={2} gap="md" stack>
			<TextField name="slug" {form} optional placeholder="made from the name">Slug (URL)</TextField>
			<TextField name="image" {form} optional>Image file name</TextField>
		</Grid>
		<MessageField name="description" {form} optional>Description</MessageField>
		<Grid columns={3} gap="md" stack>
			<NumberField name="sortOrder" {form} inputmode="numeric">Sort order</NumberField>
			<NumberField name="discountPercent" {form} inputmode="numeric">
				Bundle discount % (not for kits)
			</NumberField>
			<CheckboxField name="active" {form}>On sale in the shop</CheckboxField>
		</Grid>
	</section>

	{#each stepRows as _, i (i)}
		<section class={section}>
			<div class="flex items-center justify-between">
				<Title level={2} size="sm">Step {i + 1}</Title>
				{#if stepRows.length > 1}
					<Button
						onclick={() => steps.set(stepRows.filter((_: unknown, j: number) => j !== i))}
						size="sm"
						variant="secondary">Remove step</Button
					>
				{/if}
			</div>
			<div>
				<label class="form-label" for="step-{i}-title">Title, e.g. "Choose your switches"</label>
				<input id="step-{i}-title" {...steps[i].title.as('text')} class={input} />
			</div>
			<div>
				<label class="form-label" for="step-{i}-description">Help text (optional)</label>
				<input id="step-{i}-description" {...steps[i].description.as('text')} class={input} />
			</div>
			<Grid columns={2} gap="md" stack>
				<div>
					<label class="form-label" for="step-{i}-role">Kind of step</label>
					<select id="step-{i}-role" {...steps[i].role.as('select')} class={input}>
						{#each ROLES as role (role.value)}
							<option value={role.value}>{role.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="form-label" for="step-{i}-max-per-choice"
						>Kit fill: most slots per product (blank = no limit)</label
					>
					<input
						id="step-{i}-max-per-choice"
						{...steps[i].maxPerChoice.as('text')}
						class={input}
						inputmode="numeric"
					/>
				</div>
			</Grid>
			<Grid columns={2} gap="md" stack>
				<div>
					<label class="form-label" for="step-{i}-min-choices">Fewest picks (0 = optional)</label>
					<input
						id="step-{i}-min-choices"
						{...steps[i].minChoices.as('number')}
						class={input}
						min="0"
					/>
				</div>
				<div>
					<label class="form-label" for="step-{i}-max-choices">Most picks</label>
					<input
						id="step-{i}-max-choices"
						{...steps[i].maxChoices.as('number')}
						class={input}
						min="1"
					/>
				</div>
			</Grid>
			<div>
				<label class="form-label" for="step-{i}-skus"
					>Products offered, one SKU per line (a kit base as SKU=slots, e.g. BASE44=16)</label
				>
				<textarea
					id="step-{i}-skus"
					{...steps[i].skus.as('text')}
					class="{input} min-h-28 font-mono"></textarea>
			</div>
		</section>
	{/each}
	<div>
		<Button onclick={() => steps.set([...stepRows, newStep])} variant="secondary">Add step</Button>
	</div>

	<Cluster gap="md">
		<Button {form} loadingMessage="Saving…">Save bundle</Button>
		{#if b?.active}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
			<a href="{context.siteUrl}/bundle/{b.slug}" rel="noopener" target="_blank">View in shop</a>
		{/if}
	</Cluster>
</Form>
