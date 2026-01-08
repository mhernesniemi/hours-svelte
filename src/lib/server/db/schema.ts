import {
	pgTable,
	serial,
	integer,
	varchar,
	text,
	boolean,
	timestamp,
	index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - synced from LDAP and Visma
export const users = pgTable(
	"users",
	{
		id: serial("id").primaryKey(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		firstName: varchar("first_name", { length: 100 }).notNull(),
		lastName: varchar("last_name", { length: 100 }).notNull(),
		ldapDn: varchar("ldap_dn", { length: 500 }),
		vismaGuid: varchar("visma_guid", { length: 100 }),
		role: varchar("role", { length: 20 }).notNull().default("user"),
		countryCode: varchar("country_code", { length: 10 }).default("FI"),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("users_email_idx").on(table.email),
		index("users_visma_guid_idx").on(table.vismaGuid)
	]
);

// Sessions table - for cookie-based auth
export const sessions = pgTable(
	"sessions",
	{
		id: serial("id").primaryKey(),
		token: varchar("token", { length: 64 }).notNull().unique(),
		userId: integer("user_id")
			.references(() => users.id)
			.notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull()
	},
	(table) => [
		index("sessions_token_idx").on(table.token),
		index("sessions_user_id_idx").on(table.userId)
	]
);

// Customers table - synced from Visma
export const customers = pgTable(
	"customers",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		vismaGuid: varchar("visma_guid", { length: 100 }).unique(),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [index("customers_visma_guid_idx").on(table.vismaGuid)]
);

// Cases/Projects table - synced from Visma
export const cases = pgTable(
	"cases",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		customerId: integer("customer_id")
			.references(() => customers.id)
			.notNull(),
		vismaGuid: varchar("visma_guid", { length: 100 }).unique(),
		closed: boolean("closed").notNull().default(false),
		minBillableTimeInMin: integer("min_billable_time_in_min").default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("cases_customer_id_idx").on(table.customerId),
		index("cases_visma_guid_idx").on(table.vismaGuid)
	]
);

// Phases table - synced from Visma
export const phases = pgTable(
	"phases",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		caseId: integer("case_id")
			.references(() => cases.id)
			.notNull(),
		vismaGuid: varchar("visma_guid", { length: 100 }).unique(),
		completed: boolean("completed").notNull().default(false),
		locked: boolean("locked").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("phases_case_id_idx").on(table.caseId),
		index("phases_visma_guid_idx").on(table.vismaGuid)
	]
);

// Worktypes table - synced from Visma
export const worktypes = pgTable(
	"worktypes",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		vismaGuid: varchar("visma_guid", { length: 100 }).unique(),
		active: boolean("active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [index("worktypes_visma_guid_idx").on(table.vismaGuid)]
);

// Hour entry source types
export type HourEntrySource =
	| "inside"
	| "visma"
	| "inside-rounded"
	| "inside-rounded-overlapping"
	| "inside-minimum-billable-time";

// Hour entry status types
export type HourEntryStatus = "draft" | "confirmed" | "synced";

// Hour entries table - main hour tracking
export const hourEntries = pgTable(
	"hour_entries",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.references(() => users.id)
			.notNull(),
		phaseId: integer("phase_id").references(() => phases.id),
		worktypeId: integer("worktype_id").references(() => worktypes.id),
		description: text("description"),
		issueCode: varchar("issue_code", { length: 100 }),
		startTime: timestamp("start_time").notNull(),
		endTime: timestamp("end_time"),
		source: varchar("source", { length: 50 }).notNull().default("inside"),
		status: varchar("status", { length: 20 }).notNull().default("draft"),
		vismaGuid: varchar("visma_guid", { length: 100 }),
		originalHourEntryId: integer("original_hour_entry_id"),
		deletedAt: timestamp("deleted_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("hour_entries_user_id_idx").on(table.userId),
		index("hour_entries_start_time_idx").on(table.startTime),
		index("hour_entries_status_idx").on(table.status),
		index("hour_entries_visma_guid_idx").on(table.vismaGuid)
	]
);

// Sync log for tracking integration syncs
export const syncLogs = pgTable(
	"sync_logs",
	{
		id: serial("id").primaryKey(),
		type: varchar("type", { length: 50 }).notNull(), // 'visma-import', 'visma-export', 'clickup-sync'
		status: varchar("status", { length: 20 }).notNull(), // 'started', 'completed', 'failed'
		entityType: varchar("entity_type", { length: 50 }), // 'customers', 'cases', 'phases', 'worktypes', 'users', 'hour-entries'
		recordsProcessed: integer("records_processed").default(0),
		error: text("error"),
		startedAt: timestamp("started_at").notNull(),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull()
	},
	(table) => [
		index("sync_logs_type_idx").on(table.type),
		index("sync_logs_status_idx").on(table.status)
	]
);

// Notification log for email tracking
export const notificationLogs = pgTable(
	"notification_logs",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id").references(() => users.id),
		type: varchar("type", { length: 50 }).notNull(), // 'missing-hours', 'missing-hours-pm-report'
		recipient: varchar("recipient", { length: 255 }).notNull(),
		subject: varchar("subject", { length: 500 }),
		status: varchar("status", { length: 20 }).notNull(), // 'sent', 'failed'
		error: text("error"),
		sentAt: timestamp("sent_at").defaultNow().notNull()
	},
	(table) => [
		index("notification_logs_user_id_idx").on(table.userId),
		index("notification_logs_type_idx").on(table.type)
	]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	hourEntries: many(hourEntries),
	notificationLogs: many(notificationLogs)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const customersRelations = relations(customers, ({ many }) => ({
	cases: many(cases)
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
	customer: one(customers, { fields: [cases.customerId], references: [customers.id] }),
	phases: many(phases)
}));

export const phasesRelations = relations(phases, ({ one, many }) => ({
	case: one(cases, { fields: [phases.caseId], references: [cases.id] }),
	hourEntries: many(hourEntries)
}));

export const worktypesRelations = relations(worktypes, ({ many }) => ({
	hourEntries: many(hourEntries)
}));

export const hourEntriesRelations = relations(hourEntries, ({ one }) => ({
	user: one(users, { fields: [hourEntries.userId], references: [users.id] }),
	phase: one(phases, { fields: [hourEntries.phaseId], references: [phases.id] }),
	worktype: one(worktypes, { fields: [hourEntries.worktypeId], references: [worktypes.id] }),
	originalHourEntry: one(hourEntries, {
		fields: [hourEntries.originalHourEntryId],
		references: [hourEntries.id]
	})
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
	user: one(users, { fields: [notificationLogs.userId], references: [users.id] })
}));

// Type exports for use in the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type Phase = typeof phases.$inferSelect;
export type NewPhase = typeof phases.$inferInsert;
export type Worktype = typeof worktypes.$inferSelect;
export type NewWorktype = typeof worktypes.$inferInsert;
export type HourEntry = typeof hourEntries.$inferSelect;
export type NewHourEntry = typeof hourEntries.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;
