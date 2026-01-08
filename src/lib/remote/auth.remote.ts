import { query, command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { authenticateLdap } from '$lib/server/auth/ldap';
import { createSession, invalidateSession, validateSession, type SessionUser } from '$lib/server/auth/session';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

// Empty schema for functions that don't need input validation
const EmptySchema = v.object({});

/**
 * Login with LDAP credentials
 */
export const loginWithLdap = command(
	v.object({
		username: v.pipe(v.string(), v.minLength(1)),
		password: v.pipe(v.string(), v.minLength(1))
	}),
	async ({ username, password }) => {
		const event = getRequestEvent();
		// Authenticate against LDAP
		const ldapUser = await authenticateLdap(username, password);
		if (!ldapUser) {
			throw new Error('Invalid credentials');
		}

		// Upsert user in database
		const [user] = await db
			.insert(users)
			.values({
				email: ldapUser.email,
				firstName: ldapUser.firstName,
				lastName: ldapUser.lastName,
				ldapDn: ldapUser.ldapDn,
				active: true
			})
			.onConflictDoUpdate({
				target: users.email,
				set: {
					firstName: ldapUser.firstName,
					lastName: ldapUser.lastName,
					ldapDn: ldapUser.ldapDn,
					updatedAt: new Date()
				}
			})
			.returning();

		// Create session
		await createSession(user.id, event.cookies);

		return {
			success: true,
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role
			}
		};
	}
);

/**
 * Logout current user
 */
export const logout = command(EmptySchema, async () => {
	const event = getRequestEvent();
	await invalidateSession(event.cookies);
	return { success: true };
});

/**
 * Get current logged in user
 */
export const getCurrentUser = query(EmptySchema, async (): Promise<SessionUser | null> => {
	const event = getRequestEvent();
	return await validateSession(event.cookies);
});

/**
 * Check if user is authenticated
 */
export const isAuthenticated = query(EmptySchema, async (): Promise<boolean> => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	return user !== null;
});
