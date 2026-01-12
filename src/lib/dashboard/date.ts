import { format, parseISO, isValid, set, startOfDay, getYear, addDays, nextFriday, nextSaturday, isSameDay } from "date-fns";

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

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function calculateEaster(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

/**
 * Get all Finnish official holidays for a given year
 */
export function getFinnishHolidays(year: number): Date[] {
	const holidays: Date[] = [];

	// Fixed holidays
	holidays.push(new Date(year, 0, 1));   // New Year's Day
	holidays.push(new Date(year, 0, 6));   // Epiphany
	holidays.push(new Date(year, 4, 1));   // May Day (Vappu)
	holidays.push(new Date(year, 11, 6));  // Independence Day
	holidays.push(new Date(year, 11, 24)); // Christmas Eve
	holidays.push(new Date(year, 11, 25)); // Christmas Day
	holidays.push(new Date(year, 11, 26)); // Boxing Day (St. Stephen's Day)

	// Easter-based holidays
	const easter = calculateEaster(year);
	holidays.push(addDays(easter, -2));  // Good Friday
	holidays.push(easter);                // Easter Sunday
	holidays.push(addDays(easter, 1));   // Easter Monday
	holidays.push(addDays(easter, 39));  // Ascension Day

	// Midsummer (Friday between June 19-25)
	const midsummerEve = nextFriday(new Date(year, 5, 18)); // Friday after June 18
	holidays.push(midsummerEve);          // Midsummer Eve
	holidays.push(addDays(midsummerEve, 1)); // Midsummer Day

	// All Saints' Day (Saturday between Oct 31 - Nov 6)
	const allSaintsDay = nextSaturday(new Date(year, 9, 30)); // Saturday after Oct 30
	holidays.push(allSaintsDay);

	return holidays;
}

/**
 * Check if a date is a Finnish official holiday
 */
export function isFinnishHoliday(date: Date): boolean {
	const year = getYear(date);
	const holidays = getFinnishHolidays(year);
	return holidays.some(holiday => isSameDay(holiday, date));
}
