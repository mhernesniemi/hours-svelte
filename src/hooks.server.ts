import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	// Validate session and attach user to locals
	event.locals.user = await validateSession(event.cookies);

	return resolve(event);
};
