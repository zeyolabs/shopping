<script lang="ts">
	import Stars from './Stars.svelte';

	type Review = {
		body: string;
		createdAt: number;
		id: number;
		name: string;
		rating: number;
		title: string;
	};

	let { reviews }: { reviews: { average: null | number; count: number; list: Review[] } } =
		$props();

	const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' });
</script>

<section class="mt-12" aria-labelledby="reviews-heading">
	<h2 id="reviews-heading" class="text-xl font-semibold">Reviews</h2>
	{#if reviews.count === 0 || reviews.average === null}
		<p class="mt-2 text-[var(--txs)]">
			No reviews yet. Bought this? You can review it from your order page.
		</p>
	{:else}
		<p class="mt-2 flex items-center gap-2">
			<Stars rating={reviews.average} />
			<span
				>{reviews.average} out of 5, from {reviews.count}
				{reviews.count === 1 ? 'review' : 'reviews'}</span
			>
		</p>
		<ul class="mt-4 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
			{#each reviews.list as review (review.id)}
				<li class="py-4">
					<p class="flex flex-wrap items-center gap-2">
						<Stars rating={review.rating} size="text-sm" />
						{#if review.title}<strong>{review.title}</strong>{/if}
					</p>
					<p class="mt-2 whitespace-pre-line">{review.body}</p>
					<p class="mt-2 text-sm text-[var(--txs)]">
						{review.name}, verified buyer, {date.format(review.createdAt)}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
