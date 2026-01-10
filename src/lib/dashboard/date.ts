import { format, parseISO, isValid, set, startOfDay } from "date-fns";

/**
 * Format a date to time string (HH:mm)
 */
export function formatTime(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "HH:mm");
}

/**
 * Format weekday short name
 */
export function formatWeekday(date: Date): string {
	return format(date, "EEE");
}

/**
 * Format day number
 */
export function formatDayNumber(date: Date): string {
	return format(date, "d");
}

/**
 * Format duration between two times
 */
export function formatDuration(startTime: Date | string, endTime: Date | string): string {
	const start = typeof startTime === "string" ? new Date(startTime) : startTime;
	const end = typeof endTime === "string" ? new Date(endTime) : endTime;
	const diffMs = end.getTime() - start.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const hours = Math.floor(diffMins / 60);
	const mins = diffMins % 60;

	if (hours > 0 && mins > 0) {
		return `${hours}h ${mins}m`;
	} else if (hours > 0) {
		return `${hours}h`;
	} else {
		return `${mins}m`;
	}
}

/**
 * Parse initial date from URL search params or return today
 */
export function getInitialDate(searchParams: URLSearchParams): Date {
	const dateParam = searchParams.get("date");
	if (dateParam) {
		const parsed = parseISO(dateParam);
		if (isValid(parsed)) {
			return parsed;
		}
	}
	return new Date();
}

/**
 * Parse time string (HH:mm) and combine with a date
 */
export function parseTimeToDate(date: Date, timeStr: string): Date {
	const [hour, min] = timeStr.split(":").map(Number);
	return set(startOfDay(date), { hours: hour, minutes: min });
}
