/** Client-side: what to tell the customer when a remote command throws. Pure. */
export const ErrorMessage = {
	/**
	 * The server's message (a SvelteKit `HttpError`'s `body.message`, or an `Error`'s message), or
	 * `fallback` when there is none.
	 */
	from(error: unknown, fallback: string): string {
		if (typeof error === 'object' && error !== null) {
			const body = (error as { body?: { message?: unknown } }).body;
			if (typeof body?.message === 'string' && body.message) return body.message;
			if (error instanceof Error && error.message) return error.message;
		}
		return fallback;
	},
};
