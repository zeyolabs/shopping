<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { getAdminBundle } from '../admin.remote';
	import { saveBundleCmd } from '../admin.remote';
	import { BundleInputSchema } from '../schema';
	import { shopContext } from '../../context';
	import { FormInput } from '../../utils/form-input';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	type Bundle = Awaited<ReturnType<typeof getAdminBundle>>;
	type Step = {
		description: string;
		maxChoices: number;
		minChoices: number;
		skus: string;
		title: string;
	};

	let { bundle }: { bundle: Bundle | null } = $props();
	const b = bundle;
	const context = shopContext();

	let name = $state(b?.name ?? '');
	let slug = $state(b?.slug ?? '');
	let slugTouched = $state(b !== null);
	let description = $state(b?.description ?? '');
	let image = $state(b?.image ?? '');
	let active = $state(b?.active ?? false);
	let sortOrder = $state(b?.sortOrder ?? 0);
	let steps = $state<Step[]>(
		b?.steps.map((s) => ({ ...s, skus: s.skus.join('\n') })) ?? [
			{ description: '', maxChoices: 1, minChoices: 1, skus: '', title: '' },
		]
	);
	let saving = $state(false);
	let errors = $state<string[]>([]);

	$effect(() => {
		if (!slugTouched) slug = FormInput.slugify(name);
	});

	async function save(event?: SubmitEvent) {
		event?.preventDefault();
		const parsed = BundleInputSchema.safeParse({
			active,
			description,
			id: b?.id,
			image: image.trim() || null,
			name,
			slug,
			sortOrder,
			steps: steps.map((s) => ({
				...s,
				skus: s.skus
					.split(/[\s,]+/)
					.map((x) => x.trim())
					.filter(Boolean),
			})),
		});
		errors = parsed.success
			? []
			: parsed.error.issues.map((i) => `${i.path.join('.') || 'Form'}: ${i.message}`);
		if (!parsed.success) return;
		saving = true;
		try {
			const { id } = await saveBundleCmd(parsed.data);
			toast.success('Bundle saved.');
			if (!b) await goto(resolve('/bundles/[id]', { id: String(id) }));
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Could not save.');
		} finally {
			saving = false;
		}
	}

	const input = 'mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-1.5';
	const section = 'rounded-xl border border-[var(--line)] bg-white p-5';
</script>

<form class="grid max-w-3xl gap-6" novalidate onsubmit={save}>
	{#if errors.length > 0}
		<ul class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
			{#each errors as error (error)}<li>{error}</li>{/each}
		</ul>
	{/if}
	<section class="{section} grid gap-4 sm:grid-cols-2">
		<label class="text-sm font-medium sm:col-span-2"
			>Name<input class={input} bind:value={name} /></label
		>
		<label class="text-sm font-medium"
			>Slug (URL)<input
				class={input}
				oninput={() => (slugTouched = true)}
				bind:value={slug}
			/></label
		>
		<label class="text-sm font-medium"
			>Image file name (optional)<input class={input} bind:value={image} /></label
		>
		<label class="text-sm font-medium sm:col-span-2"
			>Description<textarea class="{input} min-h-24" bind:value={description}></textarea></label
		>
		<label class="text-sm font-medium"
			>Sort order<input class={input} type="number" bind:value={sortOrder} /></label
		>
		<label class="flex items-center gap-2 text-sm font-medium">
			<input type="checkbox" bind:checked={active} /> On sale in the shop
		</label>
	</section>

	{#each steps as step, i (i)}
		<section class={section}>
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">Step {i + 1}</h2>
				{#if steps.length > 1}
					<button
						class="text-sm underline"
						onclick={() => (steps = steps.filter((_, j) => j !== i))}
						type="button">Remove step</button
					>
				{/if}
			</div>
			<div class="mt-3 grid gap-4 sm:grid-cols-2">
				<label class="text-sm font-medium sm:col-span-2"
					>Title, e.g. "Choose your switches"<input class={input} bind:value={step.title} /></label
				>
				<label class="text-sm font-medium sm:col-span-2"
					>Help text (optional)<input class={input} bind:value={step.description} /></label
				>
				<label class="text-sm font-medium"
					>Fewest picks (0 = optional)<input
						class={input}
						min="0"
						type="number"
						bind:value={step.minChoices}
					/></label
				>
				<label class="text-sm font-medium"
					>Most picks<input
						class={input}
						min="1"
						type="number"
						bind:value={step.maxChoices}
					/></label
				>
				<label class="text-sm font-medium sm:col-span-2"
					>Products offered, one SKU per line<textarea
						class="{input} min-h-28 font-mono"
						bind:value={step.skus}></textarea></label
				>
			</div>
		</section>
	{/each}
	<div>
		<button
			class="text-sm underline"
			onclick={() =>
				(steps = [
					...steps,
					{ description: '', maxChoices: 1, minChoices: 1, skus: '', title: '' },
				])}
			type="button">Add step</button
		>
	</div>

	<div class="flex items-center gap-4">
		<Button disabled={saving} onclick={() => save()}>{saving ? 'Saving…' : 'Save bundle'}</Button>
		{#if b?.active}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the shop's own domain -->
			<a href="{context.siteUrl}/bundle/{b.slug}" rel="noopener" target="_blank">View in shop</a>
		{/if}
	</div>
</form>
