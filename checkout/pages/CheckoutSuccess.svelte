<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import SkeletonText from '@zeyolabs/ui/skeleton/SkeletonText.svelte';
	import Text from '@zeyolabs/ui/text/Text.svelte';

	import { getCheckoutOrder } from '../../orders/client.remote';
	import PageTitle from '../../ui/PageTitle.svelte';

	const sessionId = page.url.searchParams.get('session_id') ?? '';
</script>

<PageTitle description="Thank you for your order." title="Thank you" />

<Boundary message="Could not load your order number. It will be in your confirmation email.">
	<!-- `/checkout/complete` has already fulfilled the order and emptied the basket on the server. -->
	{const order = $derived(sessionId ? await getCheckoutOrder(sessionId) : null)}
	{#if order}
		<Text>
			Your order number is <strong>{order.number}</strong>. A confirmation email is on its way.
		</Text>
		{#if order.orderPath}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- token path built server-side -->
			<Text class="mt-4"><a class="btn default" href={order.orderPath}>View your order</a></Text>
		{/if}
	{:else}
		<Text>
			Thank you. Your payment is being confirmed and your order number will be emailed to you
			shortly.
		</Text>
	{/if}

	{#snippet pending()}
		<SkeletonText lines={2} />
	{/snippet}
</Boundary>
<Text class="mt-6"><a class="underline" href={resolve('/')}>Back to the shop</a></Text>
