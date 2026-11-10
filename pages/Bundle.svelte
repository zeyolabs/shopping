<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageTitle from '../components/PageTitle.svelte';
	import { addBundleToBasket, type getBundle } from '../remote/bundles.remote';
	import { shoppingClient } from '../client';
	import { productImageUrl } from '../images';
	import { formatMoney } from '../money';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	let {
		bundle,
	}: {
		/** From the route's server `load` (`bundleLoad`). */
		bundle: Awaited<ReturnType<typeof getBundle>>;
	} = $props();

	const client = shoppingClient();
	/** Step id to the chosen product ids. */
	const picked = new SvelteMap<number, SvelteSet<number>>();
	let busy = $state(false);

	const chosen = (stepId: number) => picked.get(stepId) ?? new SvelteSet<number>();

	function toggle(step: { id: number; maxChoices: number }, productId: number) {
		const set = picked.get(step.id) ?? new SvelteSet<number>();
		if (step.maxChoices === 1) {
			const was = set.has(productId);
			set.clear();
			if (!was) set.add(productId);
		} else if (set.has(productId)) {
			set.delete(productId);
		} else if (set.size < step.maxChoices) {
			set.add(productId);
		}
		picked.set(step.id, set);
	}

	const totalPence = $derived(
		bundle.steps.reduce(
			(sum, step) =>
				sum +
				step.products
					.filter((p) => chosen(step.id).has(p.id))
					.reduce((s, p) => s + p.pricePence, 0),
			0
		)
	);
	const missing = $derived(bundle.steps.find((s) => chosen(s.id).size < s.minChoices));

	async function add() {
		busy = true;
		try {
			await addBundleToBasket({
				bundleId: bundle.id,
				choices: bundle.steps.map((s) => ({ productIds: [...chosen(s.id)], stepId: s.id })),
			});
			toast.success('Bundle added to your basket');
			await goto(resolve('/basket'));
		} catch (err) {
			toast.error(
				(err as { body?: { message?: string } })?.body?.message ??
					'Could not add the bundle. Please try again.'
			);
		} finally {
			busy = false;
		}
	}

	const rule = (s: { maxChoices: number; minChoices: number }) =>
		s.minChoices === 0
			? `Optional, up to ${s.maxChoices}`
			: s.minChoices === s.maxChoices
				? `Choose ${s.minChoices}`
				: `Choose ${s.minChoices} to ${s.maxChoices}`;
</script>

<PageTitle description={bundle.description.slice(0, 160)} title={bundle.name} />

{#if bundle.description}
	<p class="-mt-4 mb-8 max-w-prose whitespace-pre-line">{bundle.description}</p>
{/if}

<ol class="space-y-10">
	{#each bundle.steps as step, i (step.id)}
		<li>
			<h2 class="text-lg font-semibold">{i + 1}. {step.title}</h2>
			<p class="text-sm text-[var(--txs)]">
				{rule(step)}{step.description ? ` · ${step.description}` : ''}
			</p>
			<ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each step.products as product (product.id)}
					{@const on = chosen(step.id).has(product.id)}
					{@const out = product.stock < 1}
					<li>
						<button
							class="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition {on
								? 'border-[var(--primary-strong)] bg-[var(--primary-soft)]'
								: 'border-[var(--bd)] bg-white'} disabled:opacity-50"
							aria-pressed={on}
							disabled={out}
							onclick={() => toggle(step, product.id)}
							type="button"
						>
							{#if product.cover}
								<img
									class="size-16 shrink-0 rounded-md object-cover"
									alt={product.cover.alt || product.name}
									loading="lazy"
									src={productImageUrl(client.imageBaseUrl, product.cover.src)}
								/>
							{/if}
							<span class="min-w-0">
								<span class="block font-medium"
									>{product.name}{product.variationLabel
										? ` · ${product.variationLabel}`
										: ''}</span
								>
								<span class="block text-sm text-[var(--txs)]">
									{out ? 'Out of stock' : formatMoney(product.pricePence)}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>

<div
	class="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] bg-white py-4"
>
	<p>
		<span class="text-[var(--txs)]">Total</span>
		<strong class="ml-2 text-xl">{formatMoney(totalPence)}</strong>
	</p>
	<div class="flex items-center gap-3">
		{#if missing}<span class="text-sm text-[var(--txs)]">{missing.title}: {rule(missing)}</span
			>{/if}
		<Button disabled={busy || missing !== undefined || totalPence === 0} onclick={add} size="lg">
			Add bundle to basket
		</Button>
	</div>
</div>
