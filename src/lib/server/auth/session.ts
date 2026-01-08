import { randomBytes } from "crypto";
import { db } from "$lib/server/db";
import { sessions, users, type User } from "$lib/server/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import type { Cookies } from "@sveltejs/kit";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface SessionUser {
	id: number;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
}

/**
 * Create a new session for a user and set the cookie
 */
export async function createSession(userId: number, cookies: Cookies): Promise<string> {
	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(sessions).values({
		token,
		userId,
		expiresAt
	});

	cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_MS / 1000
	});

	return token;
}

/**
 * Validate a session token and return the user if valid
 */
export async function validateSession(cookies: Cookies): Promise<SessionUser | null> {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (!token) return null;

	const result = await db
		.select({
			session: sessions,
			user: users
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
		.limit(1);

	if (result.length === 0) return null;

	const { user } = result[0];

	if (!user.active) return null;

	return {
		id: user.id,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		role: user.role
	};
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(cookies: Cookies): Promise<void> {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (!token) return;

	await db.delete(sessions).where(eq(sessions.token, token));

	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
}

/**
 * Delete all expired sessions (cleanup job)
 */
export async function deleteExpiredSessions(): Promise<number> {
	const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
	return result.rowCount ?? 0;
}

/**
 * Require authentication - throws redirect if not authenticated
 */
export function requireAuth(user: SessionUser | null): asserts user is SessionUser {
	if (!user) {
		throw new Error("Unauthorized");
	}
}

/**
 * Require admin role - throws error if not admin
 */
export function requireAdmin(user: SessionUser | null): asserts user is SessionUser {
	requireAuth(user);
	if (user.role !== "admin") {
		throw new Error("Forbidden");
	}
}
