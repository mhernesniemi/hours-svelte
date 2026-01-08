import type { RoundedEntry } from "./rounding";

export interface MinimumBillingEntry {
	hourEntryId: number;
	phaseId: number | null;
	worktypeId: number | null;
	startTime: Date;
	endTime: Date;
	source: "inside-minimum-billable-time";
	originalHourEntryId: number;
}

interface CaseConfig {
	caseId: number;
	minBillableTimeInMin: number;
}

interface CombinedDuration {
	phaseId: number | null;
	startTime: Date;
	endTime: Date;
	entries: RoundedEntry[];
}

// End of day limit in local time (23:55)
const END_OF_DAY_LIMIT_MINUTES = 23 * 60 + 55; // 23:55

/**
 * Combine overlapping or adjacent entries into gapless time blocks
 */
function combineIntoBlocks(entries: RoundedEntry[]): CombinedDuration[] {
	if (entries.length === 0) return [];

	const sorted = [...entries].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
	const blocks: CombinedDuration[] = [];

	let currentBlock: CombinedDuration = {
		phaseId: sorted[0].phaseId,
		startTime: sorted[0].startTime,
		endTime: sorted[0].endTime,
		entries: [sorted[0]]
	};

	for (let i = 1; i < sorted.length; i++) {
		const entry = sorted[i];

		// Check if this entry is adjacent or overlapping with current block
		if (entry.startTime <= currentBlock.endTime) {
			// Extend the block if needed
			if (entry.endTime > currentBlock.endTime) {
				currentBlock.endTime = entry.endTime;
			}
			currentBlock.entries.push(entry);
		} else {
			// Gap found - start new block
			blocks.push(currentBlock);
			currentBlock = {
				phaseId: entry.phaseId,
				startTime: entry.startTime,
				endTime: entry.endTime,
				entries: [entry]
			};
		}
	}

	blocks.push(currentBlock);
	return blocks;
}

/**
 * Get the duration of a combined block in minutes
 */
function getBlockDurationMinutes(block: CombinedDuration): number {
	return (block.endTime.getTime() - block.startTime.getTime()) / (60 * 1000);
}

/**
 * Get end of day limit (23:55) for a given date
 */
function getEndOfDayLimit(date: Date): Date {
	const result = new Date(date);
	result.setHours(23, 55, 0, 0);
	return result;
}

/**
 * Apply minimum billing algorithm to rounded entries
 * Creates padding entries to meet minimum billable time requirements
 */
export function applyMinimumBilling(
	entries: RoundedEntry[],
	getCaseConfig: (phaseId: number | null) => CaseConfig | null,
	getNextEntryStart: (afterTime: Date, excludeEntryIds: number[]) => Date | null
): MinimumBillingEntry[] {
	const paddingEntries: MinimumBillingEntry[] = [];

	// Group entries by case (via phase)
	const entriesByCase = new Map<number, RoundedEntry[]>();

	for (const entry of entries) {
		const config = getCaseConfig(entry.phaseId);
		if (!config || config.minBillableTimeInMin <= 0) continue;

		const caseId = config.caseId;
		if (!entriesByCase.has(caseId)) {
			entriesByCase.set(caseId, []);
		}
		entriesByCase.get(caseId)!.push(entry);
	}

	// Process each case
	for (const [caseId, caseEntries] of entriesByCase) {
		const config = getCaseConfig(caseEntries[0].phaseId);
		if (!config) continue;

		const minMinutes = config.minBillableTimeInMin;

		// Combine entries into gapless blocks
		const blocks = combineIntoBlocks(caseEntries);

		for (const block of blocks) {
			const blockDuration = getBlockDurationMinutes(block);

			// Check if block meets minimum
			if (blockDuration >= minMinutes) continue;

			// Calculate needed padding
			const neededPadding = minMinutes - blockDuration;
			const paddingStart = block.endTime;

			// Find where padding can end
			const endOfDayLimit = getEndOfDayLimit(paddingStart);
			const excludeIds = block.entries.map((e) => e.hourEntryId);
			const nextStart = getNextEntryStart(paddingStart, excludeIds);

			// Calculate padding end time
			let desiredEnd = new Date(paddingStart.getTime() + neededPadding * 60 * 1000);

			// Constrain by end of day
			if (desiredEnd > endOfDayLimit) {
				desiredEnd = endOfDayLimit;
			}

			// Constrain by next entry start
			if (nextStart && desiredEnd > nextStart) {
				desiredEnd = nextStart;
			}

			// Only create padding if it has positive duration
			if (desiredEnd > paddingStart) {
				// Use the first entry in the block as the reference
				const referenceEntry = block.entries[0];

				paddingEntries.push({
					hourEntryId: referenceEntry.hourEntryId,
					phaseId: referenceEntry.phaseId,
					worktypeId: referenceEntry.worktypeId,
					startTime: paddingStart,
					endTime: desiredEnd,
					source: "inside-minimum-billable-time",
					originalHourEntryId: referenceEntry.hourEntryId
				});
			}
		}
	}

	return paddingEntries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Merge minimum billing entries with rounded entries
 */
export function mergeWithRoundedEntries(
	roundedEntries: RoundedEntry[],
	minBillingEntries: MinimumBillingEntry[]
): (RoundedEntry | MinimumBillingEntry)[] {
	const all = [
		...roundedEntries,
		...minBillingEntries.map((e) => ({
			...e,
			description: null,
			originalStartTime: e.startTime,
			originalEndTime: e.endTime,
			precisionRounding: { startRounded: false, endRounded: false }
		}))
	];

	return all.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Calculate the duration of a minimum billing entry in minutes
 */
export function getMinBillingDurationMinutes(entry: MinimumBillingEntry): number {
	return (entry.endTime.getTime() - entry.startTime.getTime()) / (60 * 1000);
}
