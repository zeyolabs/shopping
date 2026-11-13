import { getBundle } from './client.remote';

/** `/bundle/<slug>`: unknown or inactive bundles 404 (a real 404 response, from the server load). */
export async function bundleLoad({ params }: { params: { slug?: string } }) {
	return { bundle: await getBundle(params.slug ?? '') };
}
