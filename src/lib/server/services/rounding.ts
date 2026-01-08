import type { HourEntry } from '$lib/server/db/schema';

const ROUNDING_INTERVAL_MINUTES = 5;

export interface RoundedEntry {
	hourEntryId: number;
	phaseId: number | null;
	worktypeId: number | null;
	startTime: Date;
	endTime: Date;
	description: string | null;
	source: 'inside-rounded' | 'inside-rounded-overlapping';
	originalStartTime: Date;
	originalEndTime: Date;
	precisionRounding: {
		startRounded: boolean;
		endRounded: boolean;
	};
}

interface EntryWithCustomer {
	entry: HourEntry;
	customerId: number | null;
}

/**
 * Round a time DOWN to the nearest interval
 */
function roundDown(date: Date, intervalMinutes: number): Date {
	const ms = intervalMinutes * 60 * 1000;
	return new Date(Math.floor(date.getTime() / ms) * ms);
}

/**
 * Round a time UP to the nearest interval
 */
function roundUp(date: Date, intervalMinutes: number): Date {
	const ms = intervalMinutes * 60 * 1000;
	return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(
	start1: Date,
	end1: Date,
	start2: Date,
	end2: Date
): boolean {
	return start1 < end2 && start2 < end1;
}

/**
 * Get overlap amount in milliseconds
 */
function getOverlapMs(
	start1: Date,
	end1: Date,
	start2: Date,
	end2: Date
): number {
	if (!rangesOverlap(start1, end1, start2, end2)) return 0;
	const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
	const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
	return overlapEnd.getTime() - overlapStart.getTime();
}

/**
 * Apply precision rounding to hour entries
 * Step 1: Round start time DOWN and end time UP to 5-minute intervals
 */
export function applyPrecisionRounding(entries: HourEntry[]): RoundedEntry[] {
	return entries
		.filter((entry) => entry.endTime !== null)
		.map((entry) => {
			const originalStart = entry.startTime;
			const originalEnd = entry.endTime!;

			const roundedStart = roundDown(originalStart, ROUNDING_INTERVAL_MINUTES);
			const roundedEnd = roundUp(originalEnd, ROUNDING_INTERVAL_MINUTES);

			return {
				hourEntryId: entry.id,
				phaseId: entry.phaseId,
				worktypeId: entry.worktypeId,
				startTime: roundedStart,
				endTime: roundedEnd,
				description: entry.description,
				source: 'inside-rounded' as const,
				originalStartTime: originalStart,
				originalEndTime: originalEnd,
				precisionRounding: {
					startRounded: roundedStart.getTime() !== originalStart.getTime(),
					endRounded: roundedEnd.getTime() !== originalEnd.getTime()
				}
			};
		})
		.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Handle precision overlapping for same customer entries
 * Step 2: If 5-min overlap occurred due to rounding and entries are for same customer,
 * postpone second entry by 5 minutes
 */
export function handlePrecisionOverlapping(
	entries: RoundedEntry[],
	getCustomerId: (phaseId: number | null) => number | null
): RoundedEntry[] {
	const result: RoundedEntry[] = [];
	const sorted = [...entries].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

	for (let i = 0; i < sorted.length; i++) {
		const current = { ...sorted[i] };

		// Check for overlaps with previous entries
		for (let j = 0; j < result.length; j++) {
			const previous = result[j];
			const overlapMs = getOverlapMs(
				previous.startTime,
				previous.endTime,
				current.startTime,
				current.endTime
			);

			// Only handle 5-minute overlaps caused by rounding
			if (overlapMs === ROUNDING_INTERVAL_MINUTES * 60 * 1000) {
				const currentCustomer = getCustomerId(current.phaseId);
				const previousCustomer = getCustomerId(previous.phaseId);

				// Same customer - postpone current entry
				if (currentCustomer === previousCustomer && currentCustomer !== null) {
					current.startTime = new Date(
						current.startTime.getTime() + ROUNDING_INTERVAL_MINUTES * 60 * 1000
					);

					// If this creates a zero-duration entry, skip it
					if (current.startTime >= current.endTime) {
						continue;
					}
				}
			}
		}

		result.push(current);
	}

	return result;
}

/**
 * Detect remaining overlaps and mark as overtime
 * Step 4-5: Find all overlaps and mark the later entry as overlapping/overtime
 */
export function handleOverlapping(entries: RoundedEntry[]): RoundedEntry[] {
	const result: RoundedEntry[] = [];
	const sorted = [...entries].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

	for (let i = 0; i < sorted.length; i++) {
		const current = { ...sorted[i] };
		let isOverlapping = false;

		// Check for overlaps with previous entries in result
		for (const previous of result) {
			if (rangesOverlap(previous.startTime, previous.endTime, current.startTime, current.endTime)) {
				// Current entry overlaps with a previous one - mark as overtime
				isOverlapping = true;
				break;
			}
		}

		if (isOverlapping) {
			current.source = 'inside-rounded-overlapping';
		}

		result.push(current);
	}

	return result;
}

/**
 * Full hours balance rounding algorithm
 * Applies all steps: precision rounding, overlap handling, and overtime marking
 */
export function applyHoursBalanceRounding(
	entries: HourEntry[],
	getCustomerId: (phaseId: number | null) => number | null
): RoundedEntry[] {
	// Step 1: Apply precision rounding
	let rounded = applyPrecisionRounding(entries);

	// Step 2: Handle precision overlapping for same customer
	rounded = handlePrecisionOverlapping(rounded, getCustomerId);

	// Steps 4-5: Detect remaining overlaps and mark as overtime
	rounded = handleOverlapping(rounded);

	return rounded;
}

/**
 * Calculate the duration in minutes for a rounded entry
 */
export function getRoundedDurationMinutes(entry: RoundedEntry): number {
	return (entry.endTime.getTime() - entry.startTime.getTime()) / (60 * 1000);
}
