import type { PackageFormat } from '../db/schema';

/** Royal Mail Click & Drop API: paid orders are pushed in so staff can print the label. */
const ORDERS_URL = 'https://api.parcel.royalmail.com/api/v1/orders';

export type ClickAndDropOrder = {
	address: {
		city?: null | string;
		country?: null | string;
		line1?: null | string;
		line2?: null | string;
		name: string;
		postal_code?: null | string;
		state?: null | string;
	};
	createdAt: number;
	/** Parcel size in mm; sent only when all three are known. */
	dimensions?: null | { heightMm: number; lengthMm: number; widthMm: number };
	email: string;
	number: string;
	/** Click & Drop package format; a plain parcel unless packing says otherwise. */
	packageFormat?: PackageFormat;
	phone?: null | string;
	/** Click & Drop service code; omitted when unset so staff choose in Click & Drop. */
	serviceCode: null | string;
	shippingPence: number;
	subtotalPence: number;
	totalPence: number;
	weightGrams: number;
};

type CreateResponse = {
	createdOrders?: { orderIdentifier: number }[];
	errorsCount?: number;
	failedOrders?: { errors?: { errorMessage?: string }[] }[];
};

const pounds = (pence: number) => pence / 100;

function headers(apiKey: string, extra: Record<string, string> = {}) {
	return { Authorization: `Bearer ${apiKey}`, ...extra };
}

/**
 * Creates the order in Click & Drop and returns its identifier. Throws on any failure so the caller
 * can log it: the customer's order is already safely recorded either way.
 */
async function createOrder(apiKey: string, order: ClickAndDropOrder): Promise<string> {
	// Shoppers only give a delivery address, so it doubles as the billing address (the API requires both).
	const address = {
		addressLine1: order.address.line1 ?? '',
		addressLine2: order.address.line2 ?? '',
		city: order.address.city ?? '',
		countryCode: order.address.country ?? 'GB',
		county: order.address.state ?? '',
		fullName: order.address.name,
		postcode: order.address.postal_code ?? '',
	};
	const contact = { emailAddress: order.email, phoneNumber: order.phone ?? '' };

	const response = await fetch(ORDERS_URL, {
		body: JSON.stringify({
			items: [
				{
					billing: { address, ...contact },
					currencyCode: 'GBP',
					orderDate: new Date(order.createdAt).toISOString(),
					orderReference: order.number,
					packages: [
						{
							...(order.dimensions
								? {
										dimensions: {
											depthInMms: order.dimensions.lengthMm,
											heightInMms: order.dimensions.heightMm,
											widthInMms: order.dimensions.widthMm,
										},
									}
								: {}),
							packageFormatIdentifier: order.packageFormat ?? 'parcel',
							weightInGrams: order.weightGrams,
						},
					],
					postageDetails: {
						sendNotificationsTo: 'recipient',
						...(order.serviceCode ? { serviceCode: order.serviceCode } : {}),
					},
					recipient: { address, ...contact },
					shippingCostCharged: pounds(order.shippingPence),
					subtotal: pounds(order.subtotalPence),
					total: pounds(order.totalPence),
				},
			],
		}),
		headers: headers(apiKey, { 'Content-Type': 'application/json' }),
		method: 'POST',
	});

	const result = (await response.json().catch(() => ({}))) as CreateResponse;
	const created = result.createdOrders?.[0];
	if (!response.ok || !created || result.errorsCount) {
		const reasons = (result.failedOrders ?? [])
			.flatMap((f) => f.errors ?? [])
			.map((e) => e.errorMessage)
			.join('; ');
		throw new Error(`Click & Drop rejected order ${order.number} (${response.status}): ${reasons}`);
	}
	return String(created.orderIdentifier);
}

/** Removes an order from Click & Drop. Only works until its label has been printed. A 404 is fine. */
async function deleteOrder(apiKey: string, orderId: string): Promise<void> {
	const response = await fetch(`${ORDERS_URL}/${encodeURIComponent(orderId)}`, {
		headers: headers(apiKey),
		method: 'DELETE',
	});
	if (!response.ok && response.status !== 404) {
		throw new Error(`Click & Drop would not remove order ${orderId} (${response.status})`);
	}
}

/** The Royal Mail tracking number once Click & Drop has one; undefined for untracked services. */
async function trackingNumber(apiKey: string, orderId: string): Promise<string | undefined> {
	const response = await fetch(`${ORDERS_URL}/${encodeURIComponent(orderId)}`, {
		headers: headers(apiKey),
	});
	if (!response.ok)
		throw new Error(`Click & Drop order ${orderId} lookup failed (${response.status})`);
	const [order] = (await response.json()) as { trackingNumber?: null | string }[];
	return order?.trackingNumber || undefined;
}

/** The postage label (with the customs form when the destination needs one) as a PDF. */
async function label(apiKey: string, orderId: string): Promise<ArrayBuffer> {
	const response = await fetch(
		`${ORDERS_URL}/${encodeURIComponent(orderId)}/label?documentType=postageLabel&includeReturnsLabel=false&includeCN=true`,
		{ headers: headers(apiKey, { Accept: 'application/pdf' }) }
	);
	if (!response.ok)
		throw new Error(`Click & Drop label for order ${orderId} failed (${response.status})`);
	return response.arrayBuffer();
}

/** Royal Mail Click & Drop, for one account. The API key comes in; nothing is read ambiently. */
export class RoyalMailClient {
	constructor(private readonly apiKey: string) {}

	/** Creates the order and returns its Click & Drop identifier. Throws on any failure. */
	createOrder(order: ClickAndDropOrder): Promise<string> {
		return createOrder(this.apiKey, order);
	}

	/** Removes an order; only works until its label is printed. A 404 is fine. */
	deleteOrder(orderId: string): Promise<void> {
		return deleteOrder(this.apiKey, orderId);
	}

	/** The postage label (and customs form when needed) as a PDF. */
	label(orderId: string): Promise<ArrayBuffer> {
		return label(this.apiKey, orderId);
	}

	/** The tracking number once Click & Drop has one; undefined for untracked services. */
	trackingNumber(orderId: string): Promise<string | undefined> {
		return trackingNumber(this.apiKey, orderId);
	}
}
