import { query, getRequestEvent } from "$app/server";
import * as v from "valibot";
import { validateSession, requireAuth } from "$lib/server/auth/session";
import { db } from "$lib/server/db";
import { customers, cases, phases, worktypes } from "$lib/server/db/schema";
import { eq, and, asc } from "drizzle-orm";

// Empty schema for functions that don't need input validation
const EmptySchema = v.object({});

/**
 * Get all active customers
 */
export const getCustomers = query(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAuth(user);

	const result = await db
		.select({
			id: customers.id,
			name: customers.name,
			vismaGuid: customers.vismaGuid
		})
		.from(customers)
		.where(eq(customers.active, true))
		.orderBy(asc(customers.name));

	return result;
});

/**
 * Get cases for a customer
 */
export const getCases = query(
	v.object({
		customerId: v.optional(v.number())
	}),
	async ({ customerId }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		const conditions = [eq(cases.closed, false)];
		if (customerId) {
			conditions.push(eq(cases.customerId, customerId));
		}

		const result = await db
			.select({
				id: cases.id,
				name: cases.name,
				customerId: cases.customerId,
				vismaGuid: cases.vismaGuid,
				minBillableTimeInMin: cases.minBillableTimeInMin
			})
			.from(cases)
			.where(and(...conditions))
			.orderBy(asc(cases.name));

		return result;
	}
);

/**
 * Get phases for a case
 */
export const getPhases = query(
	v.object({
		caseId: v.optional(v.number())
	}),
	async ({ caseId }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		const conditions = [eq(phases.completed, false), eq(phases.locked, false)];
		if (caseId) {
			conditions.push(eq(phases.caseId, caseId));
		}

		const result = await db
			.select({
				id: phases.id,
				name: phases.name,
				caseId: phases.caseId,
				vismaGuid: phases.vismaGuid
			})
			.from(phases)
			.where(and(...conditions))
			.orderBy(asc(phases.name));

		return result;
	}
);

/**
 * Get all phases with their case and customer info (for cascading selection)
 */
export const getPhasesWithHierarchy = query(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAuth(user);

	const result = await db
		.select({
			phase: {
				id: phases.id,
				name: phases.name,
				caseId: phases.caseId,
				vismaGuid: phases.vismaGuid
			},
			case: {
				id: cases.id,
				name: cases.name,
				customerId: cases.customerId
			},
			customer: {
				id: customers.id,
				name: customers.name
			}
		})
		.from(phases)
		.innerJoin(cases, eq(phases.caseId, cases.id))
		.innerJoin(customers, eq(cases.customerId, customers.id))
		.where(
			and(
				eq(phases.completed, false),
				eq(phases.locked, false),
				eq(cases.closed, false),
				eq(customers.active, true)
			)
		)
		.orderBy(asc(customers.name), asc(cases.name), asc(phases.name));

	return result.map((row) => ({
		id: row.phase.id,
		name: row.phase.name,
		fullName: `${row.customer.name} / ${row.case.name} / ${row.phase.name}`,
		caseId: row.phase.caseId,
		caseName: row.case.name,
		customerId: row.customer.id,
		customerName: row.customer.name
	}));
});

/**
 * Get all active worktypes
 */
export const getWorktypes = query(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAuth(user);

	const result = await db
		.select({
			id: worktypes.id,
			name: worktypes.name,
			vismaGuid: worktypes.vismaGuid
		})
		.from(worktypes)
		.where(eq(worktypes.active, true))
		.orderBy(asc(worktypes.name));

	return result;
});

/**
 * Search phases by name
 */
export const searchPhases = query(
	v.object({
		query: v.string()
	}),
	async ({ query: searchQuery }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		if (searchQuery.length < 2) {
			return [];
		}

		const result = await db
			.select({
				phase: {
					id: phases.id,
					name: phases.name,
					caseId: phases.caseId
				},
				case: {
					id: cases.id,
					name: cases.name,
					customerId: cases.customerId
				},
				customer: {
					id: customers.id,
					name: customers.name
				}
			})
			.from(phases)
			.innerJoin(cases, eq(phases.caseId, cases.id))
			.innerJoin(customers, eq(cases.customerId, customers.id))
			.where(
				and(
					eq(phases.completed, false),
					eq(phases.locked, false),
					eq(cases.closed, false),
					eq(customers.active, true)
				)
			)
			.orderBy(asc(customers.name), asc(cases.name), asc(phases.name))
			.limit(50);

		const lowerQuery = searchQuery.toLowerCase();

		return result
			.filter((row) => {
				const fullName =
					`${row.customer.name} ${row.case.name} ${row.phase.name}`.toLowerCase();
				return fullName.includes(lowerQuery);
			})
			.map((row) => ({
				id: row.phase.id,
				name: row.phase.name,
				fullName: `${row.customer.name} / ${row.case.name} / ${row.phase.name}`,
				caseId: row.phase.caseId,
				caseName: row.case.name,
				customerId: row.customer.id,
				customerName: row.customer.name
			}));
	}
);
