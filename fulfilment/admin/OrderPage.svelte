<script lang="ts">
	import { ErrorMessage } from '../../utils/errors';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		createOrderLabel,
		detailsForm,
		getOrder,
		getShippingServices,
		parcelForm,
		shipForm,
		updateOrderForm,
	} from '../admin.remote';
	import { OrderDetailsSchema, OrderStepSchema, ParcelSchema, ShipSchema } from '../schema';
	import { Money } from '../../utils/money';
	import { Orders } from '../../orders/library';
	import { toast } from 'svelte-sonner';
	import { PACKAGE_FORMATS } from '../../db/schema';
	import { Packing } from '../library';
	import Badge from '@zeyolabs/ui/badge/Badge.svelte';
	import Boundary from '@zeyolabs/ui/boundary/Boundary.svelte';
	import { Form, NumberField, SelectField, TextField } from '@zeyolabs/ui/form';
	import Button from '@zeyolabs/ui/form/Button.svelte';

	const number = $derived(page.params.number ?? '');

	let printing = $state(false);

	/** Creates the label in Click & Drop, then opens the PDF to print. */
	async function printLabel(orderNumber: string) {
		printing = true;
		try {
			await createOrderLabel(orderNumber);
			window.open(resolve('/orders/[number]/label', { number: orderNumber }), '_blank');
		} catch (error) {
			toast.error(ErrorMessage.from(error, 'Could not create the label.'));
		} finally {
			printing = false;
		}
	}

	const date = new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/London',
	});
</script>

<svelte:head><title>{number} · Admin</title></svelte:head>

<p><a href={resolve('/orders')}>← Orders</a></p>

<Boundary message="Could not load this order." statusMessages={{ 404: 'Order not found.' }}>
	{let order = $derived(await getOrder(number))}
	<div class="mt-4 flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-semibold">{order.number}</h1>
		<Badge
			color={order.status === 'paid'
				? 'warning'
				: order.status === 'shipped'
					? 'success'
					: 'neutral'}
		>
			{order.status === 'paid' ? 'To ship' : order.status}
		</Badge>
	</div>
	<p class="mt-1 text-sm text-[var(--ink-muted)]">
		Placed {date.format(order.createdAt)}{order.paidAt
			? ` · paid ${date.format(order.paidAt)}`
			: ''}
	</p>

	<div class="mt-6 grid gap-6 md:grid-cols-2">
		<section class="rounded-xl border border-[var(--line)] bg-white p-5">
			<h2 class="font-semibold">Ship to</h2>
			<address class="mt-2 not-italic select-all">
				{order.address.name}<br />
				{order.address.line1}<br />
				{#if order.address.line2}{order.address.line2}<br />{/if}
				{order.address.city}<br />
				{order.address.postcode}<br />
				{order.address.country}
			</address>
			<p class="mt-3 text-sm">
				<a href="mailto:{order.email}">{order.email}</a>{order.address.phone
					? ` · ${order.address.phone}`
					: ''}
			</p>
			<p class="mt-3 text-sm text-[var(--ink-muted)]">
				Service: {order.shippingService ?? 'n/a'}
				{#if order.royalMailOrderId}· Click &amp; Drop order {order.royalMailOrderId}{/if}
			</p>
		</section>

		<section class="rounded-xl border border-[var(--line)] bg-white p-5">
			<h2 class="font-semibold">Items</h2>
			<ul class="mt-2 divide-y divide-[var(--line)]">
				{#each order.items as item (item.id)}
					<li class="flex justify-between gap-4 py-2">
						<span>{item.name} <span class="text-[var(--ink-muted)]">× {item.quantity}</span></span>
						<span>{Money.format(item.quantity * item.unitPricePence)}</span>
					</li>
				{/each}
			</ul>
			<dl class="mt-3 space-y-1 text-sm">
				<div class="flex justify-between">
					<dt>Subtotal</dt>
					<dd>{Money.format(order.subtotalPence)}</dd>
				</div>
				{#if order.discountPence > 0}
					<div class="flex justify-between">
						<dt>Discount</dt>
						<dd>-{Money.format(order.discountPence)}</dd>
					</div>
				{/if}
				<div class="flex justify-between">
					<dt>Delivery</dt>
					<dd>{order.shippingPence === 0 ? 'Free' : Money.format(order.shippingPence)}</dd>
				</div>
				<div class="flex justify-between font-semibold">
					<dt>Total</dt>
					<dd>{Money.format(order.totalPence)}</dd>
				</div>
			</dl>
		</section>
	</div>

	{#if order.status === 'paid'}
		{let stage = $derived(Packing.stage(order))}
		<section class="mt-6 max-w-xl rounded-xl border border-[var(--line)] bg-white p-5">
			<div class="flex flex-wrap items-center gap-3">
				<h2 class="font-semibold">Packing</h2>
				<Badge color={Packing.STAGE_COLORS[stage]}>{Packing.STAGE_LABELS[stage]}</Badge>
			</div>
			<p class="mt-1 text-sm text-[var(--ink-muted)]">
				{#if order.heldAt}On hold since {date.format(order.heldAt)}.{/if}
				{#if order.packingStartedAt}Packing started {date.format(order.packingStartedAt)}.{/if}
				{#if order.packedAt}Packed {date.format(order.packedAt)}.{/if}
				{#if order.labelCreatedAt}Label created {date.format(order.labelCreatedAt)}.{/if}
			</p>
			<Form
				class="mt-4 flex flex-wrap gap-2"
				form={updateOrderForm}
				hidden={{ number: order.number }}
				schema={OrderStepSchema}
			>
				{#if stage === 'new'}
					<Button {...updateOrderForm.fields.step.as('submit', 'start')} form={updateOrderForm}
						>Start packing</Button
					>
				{:else if stage === 'packing'}
					<Button
						{...updateOrderForm.fields.step.as('submit', 'pack')}
						form={updateOrderForm}
						variant="secondary"
					>
						Mark packed
					</Button>
				{:else if stage === 'packed' || stage === 'label'}
					<Button disabled={printing} onclick={() => printLabel(order.number)}>
						{order.labelCreatedAt ? 'Reprint label' : 'Print label'}
					</Button>
				{/if}
				{#if stage === 'held'}
					<Button
						{...updateOrderForm.fields.step.as('submit', 'release')}
						form={updateOrderForm}
						variant="secondary"
					>
						Release hold
					</Button>
				{:else if stage !== 'label'}
					<Button
						{...updateOrderForm.fields.step.as('submit', 'hold')}
						form={updateOrderForm}
						variant="secondary"
					>
						Put on hold
					</Button>
				{/if}
			</Form>

			<p class="mt-3 text-sm text-[var(--ink-muted)]">
				Printing the label sends the saved parcel details to Royal Mail and marks the order packed.
				{#if order.labelCreatedAt}A label is already made, so later parcel changes will not change
					it.{/if}
			</p>

			<h3 class="mt-6 font-medium">Parcel</h3>
			<p class="mt-1 text-sm text-[var(--ink-muted)]">
				{order.weightGrams === null
					? `Estimated ${order.estimatedWeightGrams} g from the items. Weigh the parcel and correct it.`
					: 'Weight and size go on the Royal Mail label.'}
			</p>
			<Form
				class="mt-3 grid gap-4"
				defaults={{
					format: order.packageFormat,
					heightMm: order.packageHeightMm ?? undefined,
					lengthMm: order.packageLengthMm ?? undefined,
					weightGrams: order.weightGrams ?? (order.estimatedWeightGrams || undefined),
					widthMm: order.packageWidthMm ?? undefined,
				}}
				form={parcelForm}
				hidden={{ number: order.number }}
				reset={false}
				schema={ParcelSchema}
			>
				<NumberField name="weightGrams" form={parcelForm} inputmode="numeric"
					>Weight (g)</NumberField
				>
				<SelectField
					name="format"
					form={parcelForm}
					getLabel={(f) => Packing.FORMAT_LABELS[f]}
					items={PACKAGE_FORMATS}
					placeholder="Package format"
				/>
				<div class="grid grid-cols-3 gap-3">
					<NumberField name="lengthMm" form={parcelForm} inputmode="numeric" optional>
						Length (mm)
					</NumberField>
					<NumberField name="widthMm" form={parcelForm} inputmode="numeric" optional>
						Width (mm)
					</NumberField>
					<NumberField name="heightMm" form={parcelForm} inputmode="numeric" optional>
						Height (mm)
					</NumberField>
				</div>
				<div><Button form={parcelForm}>Save parcel</Button></div>
			</Form>
		</section>
	{/if}

	{#if order.status === 'paid' || order.status === 'shipped'}
		{let services = $derived(await getShippingServices())}
		<section class="mt-6 max-w-xl rounded-xl border border-[var(--line)] bg-white p-5">
			<details>
				<summary class="cursor-pointer font-semibold">Edit contact, address and postage</summary>
				<p class="mt-2 text-sm text-[var(--ink-muted)]">
					For fixing a typo or a customer's request. If you change the country, check the postage
					service still fits. {#if order.status === 'paid' && order.labelCreatedAt}The label is
						already made, so after a change you need to print it again.{/if}
				</p>
				<Form
					class="mt-4 grid gap-4"
					defaults={{
						city: order.address.city,
						country: order.address.country,
						email: order.email,
						line1: order.address.line1,
						line2: order.address.line2 ?? '',
						name: order.address.name,
						phone: order.address.phone ?? '',
						postcode: order.address.postcode,
						shippingService: order.shippingService ?? '',
						trackingNumber: order.trackingNumber ?? '',
					}}
					form={detailsForm}
					hidden={{ number: order.number }}
					reset={false}
					schema={OrderDetailsSchema}
				>
					<TextField name="name" form={detailsForm}>Name</TextField>
					<TextField name="email" form={detailsForm} inputmode="email">Email</TextField>
					<TextField name="phone" form={detailsForm} inputmode="tel" optional>Phone</TextField>
					<TextField name="line1" form={detailsForm}>Address line 1</TextField>
					<TextField name="line2" form={detailsForm} optional>Address line 2</TextField>
					<TextField name="city" form={detailsForm}>Town or city</TextField>
					<TextField name="postcode" autocapitalize="characters" form={detailsForm}
						>Postcode</TextField
					>
					<TextField name="country" autocapitalize="characters" form={detailsForm}
						>Country code (e.g. GB)</TextField
					>
					<SelectField
						name="shippingService"
						form={detailsForm}
						getLabel={(s) => services.find((x) => x.service === s)?.name ?? s}
						items={services.map((s) => s.service)}
						placeholder="Postage service"
					/>
					{#if order.status === 'shipped'}
						<TextField
							name="trackingNumber"
							autocapitalize="characters"
							form={detailsForm}
							optional
						>
							Tracking number (no email is sent)
						</TextField>
					{/if}
					<div><Button form={detailsForm}>Save details</Button></div>
				</Form>
			</details>
		</section>
	{/if}

	<section class="mt-6 max-w-xl rounded-xl border border-[var(--line)] bg-white p-5">
		<h2 class="font-semibold">Dispatch</h2>
		{#if order.status === 'paid' || order.status === 'shipped'}
			{#if order.shippedAt}
				<p class="mt-1 text-sm text-[var(--ink-muted)]">
					Dispatched {date.format(order.shippedAt)}.
					{#if order.dispatchEmailedAt}
						Customer emailed {date.format(order.dispatchEmailedAt)}.
					{:else}
						The customer has <strong>not</strong> been emailed.
					{/if}
				</p>
			{:else}
				<p class="mt-1 text-sm text-[var(--ink-muted)]">
					Enter the Royal Mail tracking number (leave blank if untracked), then mark it dispatched.
					The customer is emailed straight away and their order page updates.
				</p>
			{/if}
			<Form
				class="mt-4 grid gap-4"
				defaults={{ trackingNumber: order.trackingNumber ?? '' }}
				form={shipForm}
				hidden={{ number: order.number }}
				reset={false}
				schema={ShipSchema}
			>
				<TextField name="trackingNumber" autocapitalize="characters" form={shipForm} optional>
					Tracking number
				</TextField>
				<div>
					<Button form={shipForm} loadingMessage="Sending…">
						{order.shippedAt ? 'Save and resend email' : 'Mark as dispatched and email customer'}
					</Button>
				</div>
			</Form>
		{:else}
			<p class="mt-1 text-sm">This order is {order.status}, so it cannot be dispatched.</p>
		{/if}

		{#if order.trackingNumber}
			<p class="mt-4 text-sm">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Royal Mail URL -->
				<a href={Orders.trackingUrl(order.trackingNumber)} rel="noopener" target="_blank"
					>Track {order.trackingNumber} on Royal Mail</a
				>
			</p>
		{/if}
		{#if order.stripeInvoiceId}
			<p class="mt-2 text-sm">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- server route, opens Stripe's PDF -->
				<a href="/orders/{order.number}/invoice" rel="external" target="_blank">Invoice (PDF)</a>
			</p>
		{/if}
		{#if order.customerUrl}
			<p class="mt-2 text-sm">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- absolute URL on the shop domain -->
				<a href={order.customerUrl} rel="noopener" target="_blank">Customer's order page</a>
			</p>
		{/if}
	</section>
	{#snippet pending()}
		<p class="mt-6 text-[var(--ink-muted)]">Loading…</p>
	{/snippet}
</Boundary>
