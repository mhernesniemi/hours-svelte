import { browser } from "$app/environment";

const DEFAULT_WORKTYPE_KEY = "inside-default-worktype";

/**
 * Get the saved default worktype ID from localStorage
 */
export function getDefaultWorktypeId(): number | null {
	if (!browser) return null;
	const saved = localStorage.getItem(DEFAULT_WORKTYPE_KEY);
	return saved ? Number(saved) : null;
}

/**
 * Save the default worktype ID to localStorage
 */
export function saveDefaultWorktypeId(id: number | null): void {
	if (!browser || !id) return;
	localStorage.setItem(DEFAULT_WORKTYPE_KEY, String(id));
}
