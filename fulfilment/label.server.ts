import type { RequestHandler } from '@sveltejs/kit';

import { error } from '@sveltejs/kit';

import { FulfilmentManager } from './manager.server';
import { OrderNumber } from './schema';

/** The label PDF, streamed from Click & Drop. Behind Cloudflare Access like the rest of the app. */
export const GET: RequestHandler<{ number: string }> = async ({ params }) => {
	const number = OrderNumber.safeParse(params.number);
	if (!number.success) error(404, 'Order not found');
	const pdf = await FulfilmentManager.label(number.data);
	return new Response(pdf, {
		headers: {
			'Cache-Control': 'private, no-store',
			'Content-Disposition': `inline; filename="${number.data}-label.pdf"`,
			'Content-Type': 'application/pdf',
		},
	});
};
