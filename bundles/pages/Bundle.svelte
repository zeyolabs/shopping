<script lang="ts">
	import { ErrorMessage } from '../../utils/errors';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageTitle from '../../ui/PageTitle.svelte';
	import { addBundleToBasket, type getBundle } from '../client.remote';
	import { shopContext } from '../../context';
	import { Images } from '../../utils/images';
	import { Money } from '../../utils/money';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	let {
		bundle,
	}: {
		/** From the route's server `load` (`bundleLoad`). */
		bundle: Awaited<ReturnType<typeof getBundle>>;
	} = $props();

	type Step = (typeof bundle.steps)[number];
	type Option = Step['products'][number];

	const context = shopContext();
	/** pick / base / cover steps: step id to the chosen product ids. */
	const picked = new SvelteMap<number, SvelteSet<number>>();
	/** fill steps: step id to product id to slots taken. */
	const filled = new SvelteMap<number, SvelteMap<number, number>>();
	let busy = $state(false);

	const kit = $derived(bundle.steps.some((s) => s.role === 'base'));
	const chosen = (stepId: number) => picked.get(stepId) ?? new SvelteSet<number>();
	const counts = (stepId: number) => filled.get(stepId) ?? new SvelteMap<number, number>();
	const used = (stepId: number) => [...counts(stepId).values()].reduce((a, b) => a + b, 0);

	/** Slots of the chosen base: what fill and cover steps work to. */
	const slots = $derived.by(() => {
		const base = bundle.steps.find((s) => s.role === 'base');
		const id = base && [...chosen(base.id)][0];
		return base?.products.find((p) => p.id === id)?.slots ?? 0;
	});

	function toggle(step: Step, productId: number) {
		const set = picked.get(step.id) ?? new SvelteSet<number>();
		const single = step.role !== 'pick' || step.maxChoices === 1;
		if (single) {
			const was = set.has(productId);
			set.clear();
			if (!was) set.add(productId);
		} else if (set.has(productId)) {
			set.delete(productId);
		} else if (set.size < step.maxChoices) {
			set.add(productId);
		}
		picked.set(step.id, set);
		if (step.role === 'base') filled.clear();
	}

	function adjust(step: Step, product: Option, by: 1 | -1) {
		const map = filled.get(step.id) ?? new SvelteMap<number, number>();
		const next = (map.get(product.id) ?? 0) + by;
		if (next <= 0) map.delete(product.id);
		else map.set(product.id, next);
		filled.set(step.id, map);
	}

	const canAdd = (step: Step, product: Option) => {
		const n = counts(step.id).get(product.id) ?? 0;
		return (
			slots > 0 &&
			used(step.id) < slots &&
			n < product.units &&
			(step.maxPerChoice === null || n < step.maxPerChoice)
		);
	};

	const out = (step: Step, product: Option) =>
		step.role === 'fill'
			? product.units < 1
			: step.role === 'cover'
				? product.units < Math.max(1, slots)
				: product.stock < 1;

	const listPence = $derived(
		bundle.steps
			.filter((s) => s.role === 'pick' || s.role === 'base')
			.reduce(
				(sum, step) =>
					sum +
					step.products
						.filter((p) => chosen(step.id).has(p.id))
						.reduce(
							(s, p) =>
								s + (step.role === 'base' ? (p.kitPricePence ?? p.pricePence) : p.pricePence),
							0
						),
				0
			)
	);
	const totalPence = $derived(
		kit ? listPence : Math.round((listPence * (100 - bundle.discountPercent)) / 100)
	);

	/** A step that must be chosen but has nothing left: the bundle cannot be made right now. */
	const soldOut = $derived(
		bundle.steps.find(
			(s) =>
				(s.role !== 'pick' || s.minChoices > 0) &&
				s.products.every((p) =>
					s.role === 'fill' || s.role === 'cover' ? p.units < 1 : p.stock < 1
				)
		)
	);

	const missing = $derived(
		bundle.steps.find((s) => {
			if (s.role === 'fill') return slots === 0 || used(s.id) !== slots;
			if (s.role === 'base' || s.role === 'cover') return chosen(s.id).size !== 1;
			return chosen(s.id).size < s.minChoices;
		})
	);

	function rule(s: Step): string {
		if (s.role === 'base') return 'Choose a size';
		if (s.role === 'cover') return slots ? `Choose 1 (${slots} included)` : 'Choose 1';
		if (s.role === 'fill') {
			if (!slots) return 'Choose a size first';
			const each = s.maxPerChoice ? `, up to ${s.maxPerChoice} of each` : '';
			return `${used(s.id)} of ${slots} chosen${each}`;
		}
		return s.minChoices === 0
			? `Optional, up to ${s.maxChoices}`
			: s.minChoices === s.maxChoices
				? `Choose ${s.minChoices}`
				: `Choose ${s.minChoices} to ${s.maxChoices}`;
	}

	const priceLabel = (step: Step, product: Option) =>
		kit && (step.role === 'fill' || step.role === 'cover')
			? 'Included'
			: step.role === 'base' && product.slots
				? `${Money.format(product.kitPricePence ?? product.pricePence)} · ${product.slots} slots`
				: Money.format(product.pricePence);

	async function add() {
		busy = true;
		try {
			await addBundleToBasket({
				bundleId: bundle.id,
				choices: bundle.steps.map((s) => ({
					productIds:
						s.role === 'fill'
							? [...counts(s.id)].flatMap(([id, n]) => Array.from({ length: n }, () => id))
							: [...chosen(s.id)],
					stepId: s.id,
				})),
			});
			toast.success('Bundle added to your basket');
			await goto(resolve('/basket'));
		} catch (err) {
			toast.error(ErrorMessage.from(err, 'Could not add the bundle. Please try again.'));
		} finally {
			busy = false;
		}
	}
</script>

<PageTitle description={bundle.description.slice(0, 160)} title={bundle.name} />

{#if bundle.description}
	<p class="-mt-4 mb-4 max-w-prose whitespace-pre-line text-[var(--txs)]">{bundle.description}</p>
{/if}
{#if !kit && bundle.discountPercent > 0}
	<p
		class="mb-8 inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-medium text-[var(--primary-strong)]"
	>
		{bundle.discountPercent}% off when bought as a bundle
	</p>
{/if}

{#if soldOut}
	<p
		class="mb-6 rounded-xl border border-[var(--bd)] bg-[var(--sfh)] px-4 py-3 text-sm text-[var(--tx)]"
		role="status"
	>
		Not available right now: every {soldOut.title.toLowerCase()} option is sold out.
	</p>
{/if}

<ol class="mt-4 space-y-10">
	{#each bundle.steps as step, i (step.id)}
		{const locked = $derived((step.role === 'fill' || step.role === 'cover') && slots === 0)}
		<li class={locked ? 'opacity-50' : ''}>
			<h2 class="text-lg font-semibold tracking-normal">{i + 1}. {step.title}</h2>
			<p class="text-sm text-[var(--txs)]">
				{rule(step)}{step.description ? ` · ${step.description}` : ''}
			</p>
			<ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each step.products as product (product.id)}
					{const sold = $derived(out(step, product))}
					{const label = $derived(
						product.variationLabel ? `${product.name} · ${product.variationLabel}` : product.name
					)}
					<li>
						{#if step.role === 'fill'}
							{const n = $derived(counts(step.id).get(product.id) ?? 0)}
							<div
								class="flex w-full items-center gap-3 rounded-xl border p-2 transition {n > 0
									? 'border-[var(--primary-strong)] bg-[var(--primary-soft)]'
									: 'border-[var(--bd)] bg-white'} {sold ? 'opacity-50' : ''}"
							>
								{#if product.cover}
									<img
										class="size-14 shrink-0 rounded-md object-cover"
										alt={product.cover.alt || product.name}
										loading="lazy"
										src={Images.url(context.imageBaseUrl, product.cover.src)}
									/>
								{/if}
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-medium">{label}</span>
									<span class="block text-xs text-[var(--txs)]">
										{sold ? 'Out of stock' : priceLabel(step, product)}
									</span>
								</span>
								<span class="flex shrink-0 items-center gap-1">
									<Button
										aria-label="One fewer {product.name}"
										disabled={n === 0}
										icon
										onclick={() => adjust(step, product, -1)}
										size="sm"
										variant="secondary"
									>
										<Minus size={14} />
									</Button>
									<span class="w-6 text-center text-sm font-medium" aria-live="polite">{n}</span>
									<Button
										aria-label="One more {product.name}"
										disabled={sold || locked || !canAdd(step, product)}
										icon
										onclick={() => adjust(step, product, 1)}
										size="sm"
										variant="secondary"
									>
										<Plus size={14} />
									</Button>
								</span>
							</div>
						{:else}
							{const on = $derived(chosen(step.id).has(product.id))}
							<button
								class="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition {on
									? 'border-[var(--primary-strong)] bg-[var(--primary-soft)]'
									: 'border-[var(--bd)] bg-white hover:border-[var(--primary-strong)]'} disabled:opacity-50 disabled:hover:border-[var(--bd)]"
								aria-pressed={on}
								disabled={sold || locked}
								onclick={() => toggle(step, product.id)}
								type="button"
							>
								{#if product.cover}
									<img
										class="size-14 shrink-0 rounded-md object-cover"
										alt={product.cover.alt || product.name}
										loading="lazy"
										src={Images.url(context.imageBaseUrl, product.cover.src)}
									/>
								{/if}
								<span class="min-w-0">
									<span class="block text-sm font-medium">{label}</span>
									<span class="block text-xs text-[var(--txs)]">
										{sold ? 'Out of stock' : priceLabel(step, product)}
									</span>
								</span>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>

<div
	class="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] bg-white py-4"
>
	<p class="flex items-baseline gap-2">
		<span class="text-[var(--txs)]">Total</span>
		<strong class="text-xl">{Money.format(totalPence)}</strong>
		{#if totalPence < listPence}
			<s class="text-sm text-[var(--txt)]">{Money.format(listPence)}</s>
		{/if}
	</p>
	<div class="flex items-center gap-3">
		{#if missing}<span class="text-sm text-[var(--txs)]">{missing.title}: {rule(missing)}</span
			>{/if}
		<Button
			disabled={busy || soldOut !== undefined || missing !== undefined || totalPence === 0}
			onclick={add}
			size="lg"
		>
			Add bundle to basket
		</Button>
	</div>
</div>
