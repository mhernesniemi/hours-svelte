import { env } from '$env/dynamic/private';

// ClickUp API base URL
const CLICKUP_BASE_URL = 'https://api.clickup.com/api/v2';

// Type definitions for ClickUp API responses
export interface ClickUpTask {
	id: string;
	name: string;
	description?: string;
	status: {
		status: string;
		color: string;
	};
	url: string;
	custom_id?: string;
	date_created: string;
	date_updated: string;
	time_estimate?: number; // milliseconds
	time_spent?: number; // milliseconds
	assignees: ClickUpUser[];
	list: {
		id: string;
		name: string;
	};
	folder: {
		id: string;
		name: string;
	};
	space: {
		id: string;
		name: string;
	};
}

export interface ClickUpUser {
	id: number;
	username: string;
	email: string;
	color?: string;
	profilePicture?: string;
}

export interface ClickUpTimeEntry {
	id: string;
	task: {
		id: string;
		name: string;
	};
	user: ClickUpUser;
	start: string; // timestamp in ms
	end?: string; // timestamp in ms
	duration: number; // milliseconds
	description?: string;
	billable: boolean;
}

export interface ClickUpSpace {
	id: string;
	name: string;
}

export interface ClickUpFolder {
	id: string;
	name: string;
}

export interface ClickUpList {
	id: string;
	name: string;
}

/**
 * ClickUp API client
 */
class ClickUpClient {
	private apiToken: string | null = null;
	private teamId: string | null = null;

	constructor() {
		this.apiToken = env.CLICKUP_API_TOKEN || null;
		this.teamId = env.CLICKUP_TEAM_ID || null;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		if (!this.apiToken) {
			throw new Error('ClickUp API token not configured');
		}

		const response = await fetch(`${CLICKUP_BASE_URL}${endpoint}`, {
			...options,
			headers: {
				Authorization: this.apiToken,
				'Content-Type': 'application/json',
				...options.headers
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`ClickUp API error ${response.status}: ${errorText}`);
		}

		return response.json();
	}

	// Team/Workspace
	async getTeams(): Promise<{ teams: { id: string; name: string }[] }> {
		return this.request('/team');
	}

	// Spaces
	async getSpaces(): Promise<{ spaces: ClickUpSpace[] }> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');
		return this.request(`/team/${this.teamId}/space`);
	}

	// Folders
	async getFolders(spaceId: string): Promise<{ folders: ClickUpFolder[] }> {
		return this.request(`/space/${spaceId}/folder`);
	}

	// Lists
	async getLists(folderId: string): Promise<{ lists: ClickUpList[] }> {
		return this.request(`/folder/${folderId}/list`);
	}

	async getFolderlessLists(spaceId: string): Promise<{ lists: ClickUpList[] }> {
		return this.request(`/space/${spaceId}/list`);
	}

	// Tasks
	async getTask(taskId: string): Promise<ClickUpTask> {
		return this.request(`/task/${taskId}`);
	}

	async getTasks(listId: string): Promise<{ tasks: ClickUpTask[] }> {
		return this.request(`/list/${listId}/task`);
	}

	async searchTasks(query: string): Promise<{ tasks: ClickUpTask[] }> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');
		const params = new URLSearchParams({ query });
		return this.request(`/team/${this.teamId}/task?${params}`);
	}

	// Time tracking
	async getTimeEntries(params: {
		startDate?: Date;
		endDate?: Date;
		assignee?: number;
	}): Promise<{ data: ClickUpTimeEntry[] }> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');

		const queryParams = new URLSearchParams();
		if (params.startDate) {
			queryParams.set('start_date', params.startDate.getTime().toString());
		}
		if (params.endDate) {
			queryParams.set('end_date', params.endDate.getTime().toString());
		}
		if (params.assignee) {
			queryParams.set('assignee', params.assignee.toString());
		}

		return this.request(`/team/${this.teamId}/time_entries?${queryParams}`);
	}

	async createTimeEntry(data: {
		taskId?: string;
		description?: string;
		start: number; // timestamp in ms
		duration: number; // milliseconds
		billable?: boolean;
	}): Promise<ClickUpTimeEntry> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');

		return this.request(`/team/${this.teamId}/time_entries`, {
			method: 'POST',
			body: JSON.stringify({
				tid: data.taskId,
				description: data.description,
				start: data.start,
				duration: data.duration,
				billable: data.billable ?? true
			})
		});
	}

	async updateTimeEntry(
		timeEntryId: string,
		data: Partial<{
			description: string;
			start: number;
			duration: number;
			billable: boolean;
		}>
	): Promise<ClickUpTimeEntry> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');

		return this.request(`/team/${this.teamId}/time_entries/${timeEntryId}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
	}

	async deleteTimeEntry(timeEntryId: string): Promise<void> {
		if (!this.teamId) throw new Error('ClickUp team ID not configured');

		await this.request(`/team/${this.teamId}/time_entries/${timeEntryId}`, {
			method: 'DELETE'
		});
	}

	// Helper to extract task ID from URL or custom ID
	parseTaskReference(reference: string): string | null {
		// Try to extract from ClickUp URL
		const urlMatch = reference.match(/\/t\/([a-z0-9]+)/i);
		if (urlMatch) return urlMatch[1];

		// Try to extract from custom ID format (e.g., "CU-123")
		const customIdMatch = reference.match(/^[A-Z]+-\d+$/i);
		if (customIdMatch) return reference;

		// Assume it's a direct task ID if it looks like one
		if (/^[a-z0-9]+$/i.test(reference)) return reference;

		return null;
	}
}

// Export singleton instance
export const clickupClient = new ClickUpClient();
