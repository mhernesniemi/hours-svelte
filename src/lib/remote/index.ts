// Re-export all remote functions for easy importing

export { loginWithLdap, logout, getCurrentUser, isAuthenticated } from "./auth.remote";

export {
	getMonthEntries,
	getWeekStatus,
	getDayEntries,
	createEntry,
	updateEntry,
	deleteEntry,
	confirmDayEntries
} from "./hours.remote";

export {
	getCustomers,
	getCases,
	getPhases,
	getPhasesWithHierarchy,
	getWorktypes,
	searchPhases
} from "./data.remote";

export {
	getUsers,
	getSyncLogs,
	importCustomers,
	importProjects,
	importPhases,
	importWorktypes,
	importUsers,
	importAll
} from "./admin.remote";
