import { db } from "$lib/server/db";
import {
	hourEntries,
	phases,
	cases,
	customers,
	worktypes,
	type HourEntry,
	type NewHourEntry
} from "$lib/server/db/schema";
import { eq, and, gte, lte, isNull, desc, asc } from "drizzle-orm";
import {
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
	parseISO,
	format,
	differenceInMinutes
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "Europe/Helsinki";

// Custom error codes
export const ErrorCodes = {
	USER_NOT_LINKED: 1001,
	ENTRY_NOT_FOUND: 1002,
	NOT_OWNER: 1003,
	NOT_DRAFT: 1004,
	ALREADY_DELETED: 1005,
	MISSING_REQUIRED_FIELD: 1006,
	NO_ENTRIES_FOR_DAY: 1007,
	UNSUPPORTED_TIME: 1010,
	TOO_MANY_HOURS: 1011,
	MISSING_END_TIME: 1012,
	DAY_LOCKED: 1013,
	INVALID_TIME_RANGE: 1014,
	INVALID_PHASE: 1015,
	INVALID_WORKTYPE: 1016,
	DATE_OUT_OF_RANGE: 1017
} as const;

export class HourEntryError extends Error {
	code: number;

	constructor(message: string, code: number) {
		super(message);
		this.code = code;
		this.name = "HourEntryError";
	}
}

export interface HourEntryInput {
	startTime: Date;
	endTime?: Date | null;
	description?: string | null;
	issueCode?: string | null;
	phaseId?: number | null;
	worktypeId?: number | null;
}

export interface HourEntryWithRelations extends HourEntry {
	phase?: {
		id: number;
		name: string;
		case: {
			id: number;
			name: string;
			customer: {
				id: number;
				name: string;
			};
		};
	} | null;
	worktype?: {
		id: number;
		name: string;
	} | null;
}

/**
 * Validate that a time is not in the unsupported 23:55-00:00 range
 */
function validateTimeRange(time: Date): void {
	const localTime = toZonedTime(time, TIMEZONE);
	const hours = localTime.getHours();
	const minutes = localTime.getMinutes();

	if (hours === 23 && minutes >= 55) {
		throw new HourEntryError(
			"Times between 23:55 and 00:00 are not supported",
			ErrorCodes.UNSUPPORTED_TIME
		);
	}
}

/**
 * Validate that end time is after start time
 */
function validateStartEnd(startTime: Date, endTime: Date | null | undefined): void {
	if (!endTime) return;

	if (endTime <= startTime) {
		throw new HourEntryError(
			"End time must be after start time",
			ErrorCodes.INVALID_TIME_RANGE
		);
	}

	// Check they're on the same day in local time
	const localStart = toZonedTime(startTime, TIMEZONE);
	const localEnd = toZonedTime(endTime, TIMEZONE);

	if (format(localStart, "yyyy-MM-dd") !== format(localEnd, "yyyy-MM-dd")) {
		throw new HourEntryError(
			"Start and end must be on the same day",
			ErrorCodes.INVALID_TIME_RANGE
		);
	}
}

/**
 * Validate phase is active and usable
 */
async function validatePhase(phaseId: number): Promise<void> {
	const result = await db
		.select({
			phase: phases,
			case: cases,
			customer: customers
		})
		.from(phases)
		.innerJoin(cases, eq(phases.caseId, cases.id))
		.innerJoin(customers, eq(cases.customerId, customers.id))
		.where(eq(phases.id, phaseId))
		.limit(1);

	if (result.length === 0) {
		throw new HourEntryError("Phase not found", ErrorCodes.INVALID_PHASE);
	}

	const { phase, case: caseRow, customer } = result[0];

	if (phase.completed || phase.locked) {
		throw new HourEntryError("Phase is completed or locked", ErrorCodes.INVALID_PHASE);
	}

	if (caseRow.closed) {
		throw new HourEntryError("Case is closed", ErrorCodes.INVALID_PHASE);
	}

	if (!customer.active) {
		throw new HourEntryError("Customer is inactive", ErrorCodes.INVALID_PHASE);
	}
}

/**
 * Validate worktype is active
 */
async function validateWorktype(worktypeId: number): Promise<void> {
	const result = await db.select().from(worktypes).where(eq(worktypes.id, worktypeId)).limit(1);

	if (result.length === 0) {
		throw new HourEntryError("Worktype not found", ErrorCodes.INVALID_WORKTYPE);
	}

	if (!result[0].active) {
		throw new HourEntryError("Worktype is inactive", ErrorCodes.INVALID_WORKTYPE);
	}
}

/**
 * Check if a day has any confirmed entries (day is locked)
 */
async function isDayLocked(userId: number, date: Date): Promise<boolean> {
	const localDate = toZonedTime(date, TIMEZONE);
	const dayStart = fromZonedTime(startOfDay(localDate), TIMEZONE);
	const dayEnd = fromZonedTime(endOfDay(localDate), TIMEZONE);

	const result = await db
		.select()
		.from(hourEntries)
		.where(
			and(
				eq(hourEntries.userId, userId),
				gte(hourEntries.startTime, dayStart),
				lte(hourEntries.startTime, dayEnd),
				eq(hourEntries.status, "confirmed"),
				isNull(hourEntries.deletedAt)
			)
		)
		.limit(1);

	return result.length > 0;
}

/**
 * Create a new hour entry
 */
export async function createHourEntry(userId: number, input: HourEntryInput): Promise<HourEntry> {
	validateTimeRange(input.startTime);
	if (input.endTime) {
		validateTimeRange(input.endTime);
	}
	validateStartEnd(input.startTime, input.endTime);

	// Check if day is locked
	if (await isDayLocked(userId, input.startTime)) {
		throw new HourEntryError("Cannot add entries to a confirmed day", ErrorCodes.DAY_LOCKED);
	}

	// Validate phase and worktype if provided
	if (input.phaseId) {
		await validatePhase(input.phaseId);
	}
	if (input.worktypeId) {
		await validateWorktype(input.worktypeId);
	}

	const [entry] = await db
		.insert(hourEntries)
		.values({
			userId,
			startTime: input.startTime,
			endTime: input.endTime,
			description: input.description,
			issueCode: input.issueCode,
			phaseId: input.phaseId,
			worktypeId: input.worktypeId,
			source: "inside",
			status: "draft"
		})
		.returning();

	return entry;
}

/**
 * Update an existing hour entry
 */
export async function updateHourEntry(
	userId: number,
	entryId: number,
	input: Partial<HourEntryInput>
): Promise<HourEntry> {
	// Get existing entry
	const [existing] = await db
		.select()
		.from(hourEntries)
		.where(and(eq(hourEntries.id, entryId), isNull(hourEntries.deletedAt)))
		.limit(1);

	if (!existing) {
		throw new HourEntryError("Hour entry not found", ErrorCodes.ENTRY_NOT_FOUND);
	}

	if (existing.userId !== userId) {
		throw new HourEntryError("Not authorized to edit this entry", ErrorCodes.NOT_OWNER);
	}

	if (existing.status !== "draft") {
		throw new HourEntryError("Cannot edit confirmed entries", ErrorCodes.NOT_DRAFT);
	}

	// Validate times if provided
	const newStartTime = input.startTime ?? existing.startTime;
	const newEndTime = input.endTime !== undefined ? input.endTime : existing.endTime;

	validateTimeRange(newStartTime);
	if (newEndTime) {
		validateTimeRange(newEndTime);
	}
	validateStartEnd(newStartTime, newEndTime);

	// Validate phase and worktype if changed
	if (input.phaseId !== undefined && input.phaseId !== null) {
		await validatePhase(input.phaseId);
	}
	if (input.worktypeId !== undefined && input.worktypeId !== null) {
		await validateWorktype(input.worktypeId);
	}

	const [updated] = await db
		.update(hourEntries)
		.set({
			startTime: input.startTime ?? existing.startTime,
			endTime: input.endTime !== undefined ? input.endTime : existing.endTime,
			description: input.description !== undefined ? input.description : existing.description,
			issueCode: input.issueCode !== undefined ? input.issueCode : existing.issueCode,
			phaseId: input.phaseId !== undefined ? input.phaseId : existing.phaseId,
			worktypeId: input.worktypeId !== undefined ? input.worktypeId : existing.worktypeId,
			updatedAt: new Date()
		})
		.where(eq(hourEntries.id, entryId))
		.returning();

	return updated;
}

/**
 * Delete an hour entry (soft delete)
 */
export async function deleteHourEntry(userId: number, entryId: number): Promise<void> {
	const [existing] = await db
		.select()
		.from(hourEntries)
		.where(and(eq(hourEntries.id, entryId), isNull(hourEntries.deletedAt)))
		.limit(1);

	if (!existing) {
		throw new HourEntryError("Hour entry not found", ErrorCodes.ENTRY_NOT_FOUND);
	}

	if (existing.userId !== userId) {
		throw new HourEntryError("Not authorized to delete this entry", ErrorCodes.NOT_OWNER);
	}

	if (existing.status !== "draft") {
		throw new HourEntryError("Cannot delete confirmed entries", ErrorCodes.NOT_DRAFT);
	}

	await db
		.update(hourEntries)
		.set({
			deletedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(hourEntries.id, entryId));
}

/**
 * Get hour entries for a user in a given month
 */
export async function getHourEntriesForMonth(
	userId: number,
	year: number,
	month: number,
	order: "asc" | "desc" = "asc"
): Promise<HourEntryWithRelations[]> {
	const monthStart = fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
	const monthEnd = fromZonedTime(endOfMonth(new Date(year, month - 1, 1)), TIMEZONE);

	const entries = await db
		.select({
			entry: hourEntries,
			phase: phases,
			case: cases,
			customer: customers,
			worktype: worktypes
		})
		.from(hourEntries)
		.leftJoin(phases, eq(hourEntries.phaseId, phases.id))
		.leftJoin(cases, eq(phases.caseId, cases.id))
		.leftJoin(customers, eq(cases.customerId, customers.id))
		.leftJoin(worktypes, eq(hourEntries.worktypeId, worktypes.id))
		.where(
			and(
				eq(hourEntries.userId, userId),
				gte(hourEntries.startTime, monthStart),
				lte(hourEntries.startTime, monthEnd),
				isNull(hourEntries.deletedAt)
			)
		)
		.orderBy(order === "asc" ? asc(hourEntries.startTime) : desc(hourEntries.startTime));

	return entries.map((row) => ({
		...row.entry,
		phase: row.phase
			? {
					id: row.phase.id,
					name: row.phase.name,
					case: row.case
						? {
								id: row.case.id,
								name: row.case.name,
								customer: row.customer
									? {
											id: row.customer.id,
											name: row.customer.name
										}
									: { id: 0, name: "" }
							}
						: { id: 0, name: "", customer: { id: 0, name: "" } }
				}
			: null,
		worktype: row.worktype
			? {
					id: row.worktype.id,
					name: row.worktype.name
				}
			: null
	}));
}

/**
 * Get hour entries for a specific day
 */
export async function getHourEntriesForDay(
	userId: number,
	date: Date
): Promise<HourEntryWithRelations[]> {
	const localDate = toZonedTime(date, TIMEZONE);
	const dayStart = fromZonedTime(startOfDay(localDate), TIMEZONE);
	const dayEnd = fromZonedTime(endOfDay(localDate), TIMEZONE);

	const entries = await db
		.select({
			entry: hourEntries,
			phase: phases,
			case: cases,
			customer: customers,
			worktype: worktypes
		})
		.from(hourEntries)
		.leftJoin(phases, eq(hourEntries.phaseId, phases.id))
		.leftJoin(cases, eq(phases.caseId, cases.id))
		.leftJoin(customers, eq(cases.customerId, customers.id))
		.leftJoin(worktypes, eq(hourEntries.worktypeId, worktypes.id))
		.where(
			and(
				eq(hourEntries.userId, userId),
				gte(hourEntries.startTime, dayStart),
				lte(hourEntries.startTime, dayEnd),
				isNull(hourEntries.deletedAt)
			)
		)
		.orderBy(asc(hourEntries.startTime));

	return entries.map((row) => ({
		...row.entry,
		phase: row.phase
			? {
					id: row.phase.id,
					name: row.phase.name,
					case: row.case
						? {
								id: row.case.id,
								name: row.case.name,
								customer: row.customer
									? {
											id: row.customer.id,
											name: row.customer.name
										}
									: { id: 0, name: "" }
							}
						: { id: 0, name: "", customer: { id: 0, name: "" } }
				}
			: null,
		worktype: row.worktype
			? {
					id: row.worktype.id,
					name: row.worktype.name
				}
			: null
	}));
}

/**
 * Confirm all draft entries for a specific day
 */
export async function confirmDay(userId: number, date: Date): Promise<HourEntry[]> {
	const localDate = toZonedTime(date, TIMEZONE);
	const dayStart = fromZonedTime(startOfDay(localDate), TIMEZONE);
	const dayEnd = fromZonedTime(endOfDay(localDate), TIMEZONE);

	// Get all draft entries for the day
	const draftEntries = await db
		.select()
		.from(hourEntries)
		.where(
			and(
				eq(hourEntries.userId, userId),
				gte(hourEntries.startTime, dayStart),
				lte(hourEntries.startTime, dayEnd),
				eq(hourEntries.status, "draft"),
				eq(hourEntries.source, "inside"),
				isNull(hourEntries.deletedAt)
			)
		);

	if (draftEntries.length === 0) {
		throw new HourEntryError(
			"No draft entries found for this day",
			ErrorCodes.NO_ENTRIES_FOR_DAY
		);
	}

	// Validate all entries have required fields
	for (const entry of draftEntries) {
		if (!entry.description || entry.description.trim() === "") {
			throw new HourEntryError(
				"All entries must have a description",
				ErrorCodes.MISSING_REQUIRED_FIELD
			);
		}
		if (!entry.phaseId) {
			throw new HourEntryError(
				"All entries must have a phase selected",
				ErrorCodes.INVALID_PHASE
			);
		}
		if (!entry.worktypeId) {
			throw new HourEntryError(
				"All entries must have a worktype selected",
				ErrorCodes.INVALID_WORKTYPE
			);
		}
		if (!entry.endTime) {
			throw new HourEntryError(
				"All entries must have an end time",
				ErrorCodes.MISSING_END_TIME
			);
		}
	}

	// Confirm all entries
	const confirmedEntries: HourEntry[] = [];
	for (const entry of draftEntries) {
		const [confirmed] = await db
			.update(hourEntries)
			.set({
				status: "confirmed",
				updatedAt: new Date()
			})
			.where(eq(hourEntries.id, entry.id))
			.returning();

		confirmedEntries.push(confirmed);
	}

	return confirmedEntries;
}

/**
 * Calculate total hours for entries
 */
export function calculateTotalMinutes(entries: HourEntry[]): number {
	return entries.reduce((total, entry) => {
		if (!entry.endTime) return total;
		return total + differenceInMinutes(entry.endTime, entry.startTime);
	}, 0);
}

/**
 * Format minutes as hours and minutes string
 */
export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}
