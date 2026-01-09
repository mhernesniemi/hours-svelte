import { query, command, getRequestEvent } from "$app/server";
import * as v from "valibot";
import { validateSession, requireAdmin } from "$lib/server/auth/session";
import { db } from "$lib/server/db";
import { users, customers, cases, phases, worktypes, syncLogs } from "$lib/server/db/schema";
import { vismaClient } from "$lib/server/integrations/visma";
import { desc, eq } from "drizzle-orm";

// Empty schema for functions that don't need input validation
const EmptySchema = v.object({});

/**
 * Get all users (admin only)
 */
export const getUsers = query(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const result = await db
		.select({
			id: users.id,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			role: users.role,
			active: users.active,
			vismaGuid: users.vismaGuid,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.lastName, users.firstName);

	return result;
});

/**
 * Get recent sync logs
 */
export const getSyncLogs = query(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const result = await db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(50);

	return result;
});

/**
 * Import customers from Visma
 */
export const importCustomers = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	// Create sync log entry
	const [log] = await db
		.insert(syncLogs)
		.values({
			type: "visma-import",
			entityType: "customers",
			status: "started",
			startedAt: new Date()
		})
		.returning();

	try {
		console.log("[ImportCustomers] Starting Visma customer fetch...");
		const vismaCustomers = await vismaClient.getCustomers();
		console.log(`[ImportCustomers] Received ${vismaCustomers.length} customers from Visma`);
		let processed = 0;

		for (const vc of vismaCustomers) {
			await db
				.insert(customers)
				.values({
					name: vc.name,
					vismaGuid: vc.guid,
					active: vc.isActive
				})
				.onConflictDoUpdate({
					target: customers.vismaGuid,
					set: {
						name: vc.name,
						active: vc.isActive,
						updatedAt: new Date()
					}
				});
			processed++;
		}

		await db
			.update(syncLogs)
			.set({
				status: "completed",
				recordsProcessed: processed,
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		return { success: true, processed };
	} catch (error) {
		await db
			.update(syncLogs)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		throw error;
	}
});

/**
 * Import projects/cases from Visma
 */
export const importProjects = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const [log] = await db
		.insert(syncLogs)
		.values({
			type: "visma-import",
			entityType: "cases",
			status: "started",
			startedAt: new Date()
		})
		.returning();

	try {
		const vismaProjects = await vismaClient.getProjects();
		let processed = 0;

		// Get customer mapping from database
		const customerMap = new Map<string, number>();
		const allCustomers = await db.select().from(customers);
		for (const c of allCustomers) {
			if (c.vismaGuid) customerMap.set(c.vismaGuid, c.id);
		}

		// Log customer count for debugging
		console.log(`Found ${customerMap.size} customers in database for project mapping`);

		for (const vp of vismaProjects) {
			// Use customer.guid from the nested customer object (Visma API v1.0 format)
			const customerGuid = vp.customer?.guid;

			if (!customerGuid) {
				console.log(`Skipping project ${vp.name} - no customer assigned`);
				continue;
			}

			const customerId = customerMap.get(customerGuid);
			if (!customerId) {
				console.log(
					`Skipping project ${vp.name} - customer not in DB: ${vp.customer?.name} (${customerGuid})`
				);
				continue;
			}

			await db
				.insert(cases)
				.values({
					name: vp.name,
					vismaGuid: vp.guid,
					customerId,
					closed: vp.isClosed
				})
				.onConflictDoUpdate({
					target: cases.vismaGuid,
					set: {
						name: vp.name,
						closed: vp.isClosed,
						updatedAt: new Date()
					}
				});
			processed++;
		}

		await db
			.update(syncLogs)
			.set({
				status: "completed",
				recordsProcessed: processed,
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		return { success: true, processed };
	} catch (error) {
		await db
			.update(syncLogs)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		throw error;
	}
});

/**
 * Import phases from Visma
 */
export const importPhases = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const [log] = await db
		.insert(syncLogs)
		.values({
			type: "visma-import",
			entityType: "phases",
			status: "started",
			startedAt: new Date()
		})
		.returning();

	try {
		const vismaPhases = await vismaClient.getPhases();
		let processed = 0;

		// Get case mapping
		const caseMap = new Map<string, number>();
		const allCases = await db.select().from(cases);
		for (const c of allCases) {
			if (c.vismaGuid) caseMap.set(c.vismaGuid, c.id);
		}

		for (const vph of vismaPhases) {
			const caseId = caseMap.get(vph.projectGuid);
			if (!caseId) {
				console.log(`Skipping phase ${vph.name} - case not found: ${vph.projectGuid}`);
				continue;
			}

			await db
				.insert(phases)
				.values({
					name: vph.name,
					vismaGuid: vph.guid,
					caseId,
					completed: vph.isCompleted,
					locked: vph.isLocked
				})
				.onConflictDoUpdate({
					target: phases.vismaGuid,
					set: {
						name: vph.name,
						completed: vph.isCompleted,
						locked: vph.isLocked,
						updatedAt: new Date()
					}
				});
			processed++;
		}

		await db
			.update(syncLogs)
			.set({
				status: "completed",
				recordsProcessed: processed,
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		return { success: true, processed };
	} catch (error) {
		await db
			.update(syncLogs)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		throw error;
	}
});

/**
 * Import worktypes from Visma
 */
export const importWorktypes = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const [log] = await db
		.insert(syncLogs)
		.values({
			type: "visma-import",
			entityType: "worktypes",
			status: "started",
			startedAt: new Date()
		})
		.returning();

	try {
		const vismaWorktypes = await vismaClient.getWorkTypes();
		let processed = 0;

		for (const vwt of vismaWorktypes) {
			await db
				.insert(worktypes)
				.values({
					name: vwt.name,
					vismaGuid: vwt.guid,
					active: vwt.isActive
				})
				.onConflictDoUpdate({
					target: worktypes.vismaGuid,
					set: {
						name: vwt.name,
						active: vwt.isActive,
						updatedAt: new Date()
					}
				});
			processed++;
		}

		await db
			.update(syncLogs)
			.set({
				status: "completed",
				recordsProcessed: processed,
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		return { success: true, processed };
	} catch (error) {
		await db
			.update(syncLogs)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		throw error;
	}
});

/**
 * Import users from Visma
 */
export const importUsers = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const [log] = await db
		.insert(syncLogs)
		.values({
			type: "visma-import",
			entityType: "users",
			status: "started",
			startedAt: new Date()
		})
		.returning();

	try {
		const vismaUsers = await vismaClient.getUsers();
		let processed = 0;

		for (const vu of vismaUsers) {
			if (!vu.email) continue;

			await db
				.insert(users)
				.values({
					email: vu.email.toLowerCase(),
					firstName: vu.firstName,
					lastName: vu.lastName,
					vismaGuid: vu.guid,
					active: vu.isActive
				})
				.onConflictDoUpdate({
					target: users.email,
					set: {
						firstName: vu.firstName,
						lastName: vu.lastName,
						vismaGuid: vu.guid,
						active: vu.isActive,
						updatedAt: new Date()
					}
				});
			processed++;
		}

		await db
			.update(syncLogs)
			.set({
				status: "completed",
				recordsProcessed: processed,
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		return { success: true, processed };
	} catch (error) {
		await db
			.update(syncLogs)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				completedAt: new Date()
			})
			.where(eq(syncLogs.id, log.id));

		throw error;
	}
});

/**
 * Import all data from Visma in order
 */
export const importAll = command(EmptySchema, async () => {
	const event = getRequestEvent();
	const user = await validateSession(event.cookies);
	requireAdmin(user);

	const results = {
		customers: { success: false, processed: 0 },
		projects: { success: false, processed: 0 },
		phases: { success: false, processed: 0 },
		worktypes: { success: false, processed: 0 },
		users: { success: false, processed: 0 }
	};

	try {
		// Import in dependency order
		const customersResult = await importCustomers({});
		results.customers = { success: true, processed: customersResult.processed };

		const projectsResult = await importProjects({});
		results.projects = { success: true, processed: projectsResult.processed };

		const phasesResult = await importPhases({});
		results.phases = { success: true, processed: phasesResult.processed };

		const worktypesResult = await importWorktypes({});
		results.worktypes = { success: true, processed: worktypesResult.processed };

		const usersResult = await importUsers({});
		results.users = { success: true, processed: usersResult.processed };

		return { success: true, results };
	} catch (error) {
		return {
			success: false,
			results,
			error: error instanceof Error ? error.message : "Unknown error"
		};
	}
});
