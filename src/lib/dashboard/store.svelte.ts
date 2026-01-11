import { startOfWeek, addWeeks, subWeeks, addDays, isSameDay, format } from "date-fns";
import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";
import { getInitialDate } from "./date";

// Type for entry data when copying
type CopyEntryData = {
	endTime: Date | string | null;
	description: string | null;
	phaseId: number | null;
	worktypeId: number | null;
} | null;

// Type for entry validation error
type EntryError = {
	entryId: number;
	field: string;
} | null;

// Create store state - needs to be initialized after page load
let _selectedDate = $state<Date>(new Date());
let _currentWeekStart = $state<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
let _editingEntryId = $state<number | null>(null);
let _showNewEntryForm = $state(false);
let _copyFromEntry = $state<CopyEntryData>(null);
let _entryError = $state<EntryError>(null);
let _error = $state("");

// Getters for reactive access
export function getSelectedDate() {
	return _selectedDate;
}

export function getCurrentWeekStart() {
	return _currentWeekStart;
}

export function getEditingEntryId() {
	return _editingEntryId;
}

export function getShowNewEntryForm() {
	return _showNewEntryForm;
}

export function getCopyFromEntry() {
	return _copyFromEntry;
}

export function getError() {
	return _error;
}

export function getEntryError() {
	return _entryError;
}

// Initialize from URL params
export function initializeFromUrl(searchParams: URLSearchParams) {
	const date = getInitialDate(searchParams);
	_selectedDate = date;
	_currentWeekStart = startOfWeek(date, { weekStartsOn: 1 });
}

// Update URL when date changes
export function syncUrlWithDate(pageUrl: URL) {
	if (browser) {
		const dateStr = format(_selectedDate, "yyyy-MM-dd");
		const url = new URL(pageUrl);
		url.searchParams.set("date", dateStr);
		replaceState(url, {});
	}
}

// Actions
export function selectDay(day: Date) {
	_selectedDate = day;
	_editingEntryId = null;
	_showNewEntryForm = false;
	_error = "";
}

export function navigateWeek(direction: "prev" | "next") {
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(_currentWeekStart, i));
	_currentWeekStart =
		direction === "prev" ? subWeeks(_currentWeekStart, 1) : addWeeks(_currentWeekStart, 1);
	const dayOffset = weekDays.findIndex((d) => isSameDay(d, _selectedDate));
	_selectedDate = addDays(_currentWeekStart, dayOffset >= 0 ? dayOffset : 0);
	_editingEntryId = null;
	_showNewEntryForm = false;
}

export function startEditing(id: number) {
	_showNewEntryForm = false;
	_editingEntryId = id;
	_error = "";
}

export function startCreating() {
	_showNewEntryForm = true;
	_editingEntryId = null;
	_copyFromEntry = null;
}

export function startCopying(entry: NonNullable<CopyEntryData>) {
	_showNewEntryForm = true;
	_editingEntryId = null;
	_copyFromEntry = entry;
}

export function resetForm() {
	_editingEntryId = null;
	_showNewEntryForm = false;
	_copyFromEntry = null;
	_error = "";
}

export function setError(message: string, entryId?: number, field?: string) {
	_error = message;
	if (entryId && field) {
		_entryError = { entryId, field };
	}
}

export function clearError() {
	_error = "";
	_entryError = null;
}
