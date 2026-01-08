export { vismaClient } from './visma';
export type { VismaUser, VismaCustomer, VismaProject, VismaPhase, VismaWorkType, VismaWorkHour } from './visma';

export { clickupClient } from './clickup';
export type { ClickUpTask, ClickUpUser, ClickUpTimeEntry } from './clickup';

export {
	sendMissingHoursNotification,
	sendPMReport,
	sendSystemAlert
} from './email';
export type { MissingHoursData, PMReportData } from './email';
