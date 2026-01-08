import { query, command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { validateSession, requireAuth } from '$lib/server/auth/session';
import {
	createHourEntry,
	updateHourEntry,
	deleteHourEntry,
	getHourEntriesForMonth,
	getHourEntriesForDay,
	confirmDay,
	calculateTotalMinutes,
	formatDuration,
	HourEntryError
} from '$lib/server/services/hour-entries';

// Date schema - accepts ISO string or Date
const DateSchema = v.pipe(
	v.union([v.string(), v.date()]),
	v.transform((val) => (typeof val === 'string' ? new Date(val) : val))
);

/**
 * Get hour entries for a specific month
 */
export const getMonthEntries = query(
	v.object({
		year: v.number(),
		month: v.pipe(v.number(), v.minValue(1), v.maxValue(12))
	}),
	async ({ year, month }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		const entries = await getHourEntriesForMonth(user.id, year, month);

		// Group by date
		const byDate = new Map<string, typeof entries>();
		for (const entry of entries) {
			const dateKey = entry.startTime.toISOString().split('T')[0];
			if (!byDate.has(dateKey)) {
				byDate.set(dateKey, []);
			}
			byDate.get(dateKey)!.push(entry);
		}

		// Calculate totals per day
		const days = Array.from(byDate.entries()).map(([date, dayEntries]) => {
			const totalMinutes = calculateTotalMinutes(dayEntries);
			const hasUnconfirmed = dayEntries.some((e) => e.status === 'draft');
			const allConfirmed = dayEntries.every((e) => e.status !== 'draft');

			return {
				date,
				entries: dayEntries,
				totalMinutes,
				totalFormatted: formatDuration(totalMinutes),
				hasUnconfirmed,
				allConfirmed
			};
		});

		return {
			entries,
			days,
			totalMinutes: calculateTotalMinutes(entries),
			totalFormatted: formatDuration(calculateTotalMinutes(entries))
		};
	}
);

/**
 * Get hour entries for a specific day
 */
export const getDayEntries = query(
	v.object({
		date: DateSchema
	}),
	async ({ date }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		const entries = await getHourEntriesForDay(user.id, date);
		const totalMinutes = calculateTotalMinutes(entries);

		return {
			entries,
			totalMinutes,
			totalFormatted: formatDuration(totalMinutes),
			hasUnconfirmed: entries.some((e) => e.status === 'draft'),
			allConfirmed: entries.length > 0 && entries.every((e) => e.status !== 'draft')
		};
	}
);

/**
 * Create a new hour entry
 */
export const createEntry = command(
	v.object({
		startTime: DateSchema,
		endTime: v.optional(v.nullable(DateSchema)),
		description: v.optional(v.nullable(v.string())),
		issueCode: v.optional(v.nullable(v.string())),
		phaseId: v.optional(v.nullable(v.number())),
		worktypeId: v.optional(v.nullable(v.number()))
	}),
	async (input) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		try {
			const entry = await createHourEntry(user.id, input);
			return { success: true, entry };
		} catch (error) {
			if (error instanceof HourEntryError) {
				return { success: false, error: error.message, code: error.code };
			}
			throw error;
		}
	}
);

/**
 * Update an existing hour entry
 */
export const updateEntry = command(
	v.object({
		entryId: v.number(),
		startTime: v.optional(DateSchema),
		endTime: v.optional(v.nullable(DateSchema)),
		description: v.optional(v.nullable(v.string())),
		issueCode: v.optional(v.nullable(v.string())),
		phaseId: v.optional(v.nullable(v.number())),
		worktypeId: v.optional(v.nullable(v.number()))
	}),
	async ({ entryId, ...input }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		try {
			const entry = await updateHourEntry(user.id, entryId, input);
			return { success: true, entry };
		} catch (error) {
			if (error instanceof HourEntryError) {
				return { success: false, error: error.message, code: error.code };
			}
			throw error;
		}
	}
);

/**
 * Delete an hour entry
 */
export const deleteEntry = command(
	v.object({
		entryId: v.number()
	}),
	async ({ entryId }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		try {
			await deleteHourEntry(user.id, entryId);
			return { success: true };
		} catch (error) {
			if (error instanceof HourEntryError) {
				return { success: false, error: error.message, code: error.code };
			}
			throw error;
		}
	}
);

/**
 * Confirm all entries for a day
 */
export const confirmDayEntries = command(
	v.object({
		date: DateSchema
	}),
	async ({ date }) => {
		const event = getRequestEvent();
		const user = await validateSession(event.cookies);
		requireAuth(user);

		try {
			const entries = await confirmDay(user.id, date);
			return { success: true, entries };
		} catch (error) {
			if (error instanceof HourEntryError) {
				return { success: false, error: error.message, code: error.code };
			}
			throw error;
		}
	}
);
