import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { notificationLogs } from '$lib/server/db/schema';
import { format } from 'date-fns';

// Initialize Resend client
function getResendClient(): Resend | null {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) return null;
	return new Resend(apiKey);
}

// Email configuration
function getEmailConfig() {
	return {
		fromEmail: env.EMAIL_FROM || 'Inside <noreply@inside.example.com>',
		pmEmail: env.PM_EMAIL || null,
		alertEmail: env.ALERT_EMAIL || null,
		serverName: env.SERVER_NAME || 'Inside'
	};
}

export interface MissingHoursData {
	userId: number;
	email: string;
	firstName: string;
	daysWithMissingHours: Date[];
	daysWithUnconfirmedHours: Date[];
}

export interface PMReportData {
	month: string; // YYYY-MM format
	usersWithMissingHours: {
		firstName: string;
		lastName: string;
		email: string;
		missingDaysCount: number;
	}[];
}

/**
 * Send missing hours notification to a user
 */
export async function sendMissingHoursNotification(data: MissingHoursData): Promise<boolean> {
	const resend = getResendClient();
	const config = getEmailConfig();

	if (!resend) {
		console.log('Email sending disabled - no Resend API key configured');
		return false;
	}

	const subject = `[${config.serverName}] Missing or unconfirmed hours`;

	const missingDaysList = data.daysWithMissingHours
		.map((d) => format(d, 'EEEE, MMMM d, yyyy'))
		.join('\n  - ');

	const unconfirmedDaysList = data.daysWithUnconfirmedHours
		.map((d) => format(d, 'EEEE, MMMM d, yyyy'))
		.join('\n  - ');

	let body = `Hi ${data.firstName},\n\n`;
	body += `This is a reminder about your time tracking in ${config.serverName}.\n\n`;

	if (data.daysWithMissingHours.length > 0) {
		body += `You have no hours logged for the following days:\n  - ${missingDaysList}\n\n`;
	}

	if (data.daysWithUnconfirmedHours.length > 0) {
		body += `You have unconfirmed hours for the following days:\n  - ${unconfirmedDaysList}\n\n`;
	}

	body += `Please log and confirm your hours as soon as possible.\n\n`;
	body += `Best regards,\n${config.serverName} System`;

	try {
		await resend.emails.send({
			from: config.fromEmail,
			to: data.email,
			subject,
			text: body
		});

		// Log successful notification
		await db.insert(notificationLogs).values({
			userId: data.userId,
			type: 'missing-hours',
			recipient: data.email,
			subject,
			status: 'sent'
		});

		return true;
	} catch (error) {
		console.error('Failed to send missing hours notification:', error);

		// Log failed notification
		await db.insert(notificationLogs).values({
			userId: data.userId,
			type: 'missing-hours',
			recipient: data.email,
			subject,
			status: 'failed',
			error: error instanceof Error ? error.message : 'Unknown error'
		});

		return false;
	}
}

/**
 * Send monthly PM report with users who have missing hours
 */
export async function sendPMReport(data: PMReportData): Promise<boolean> {
	const resend = getResendClient();
	const config = getEmailConfig();

	if (!resend || !config.pmEmail) {
		console.log('PM report disabled - no Resend API key or PM email configured');
		return false;
	}

	const subject = `[${config.serverName}] Monthly Missing Hours Report - ${data.month}`;

	let body = `Missing Hours Report for ${data.month}\n\n`;
	body += `The following employees have missing hours for this month:\n\n`;

	for (const user of data.usersWithMissingHours) {
		body += `- ${user.firstName} ${user.lastName} (${user.email}): ${user.missingDaysCount} days\n`;
	}

	body += `\nTotal: ${data.usersWithMissingHours.length} employees with missing hours.\n`;
	body += `\nPlease follow up as needed.\n`;
	body += `\n${config.serverName} System`;

	try {
		await resend.emails.send({
			from: config.fromEmail,
			to: config.pmEmail,
			subject,
			text: body
		});

		// Log successful notification
		await db.insert(notificationLogs).values({
			type: 'missing-hours-pm-report',
			recipient: config.pmEmail,
			subject,
			status: 'sent'
		});

		return true;
	} catch (error) {
		console.error('Failed to send PM report:', error);

		// Log failed notification
		await db.insert(notificationLogs).values({
			type: 'missing-hours-pm-report',
			recipient: config.pmEmail,
			subject,
			status: 'failed',
			error: error instanceof Error ? error.message : 'Unknown error'
		});

		return false;
	}
}

/**
 * Send system alert email
 */
export async function sendSystemAlert(subject: string, message: string): Promise<boolean> {
	const resend = getResendClient();
	const config = getEmailConfig();

	if (!resend || !config.alertEmail) {
		console.log('System alerts disabled - no Resend API key or alert email configured');
		return false;
	}

	try {
		await resend.emails.send({
			from: config.fromEmail,
			to: config.alertEmail,
			subject: `[${config.serverName} ALERT] ${subject}`,
			text: message
		});

		return true;
	} catch (error) {
		console.error('Failed to send system alert:', error);
		return false;
	}
}
