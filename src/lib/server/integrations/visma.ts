import { env } from "$env/dynamic/private";

// Base URL for Visma Severa REST API
const VISMA_BASE_URL = "https://api.severa.visma.com/rest-api/v1.0";

// Type definitions for Visma API responses
export interface VismaUser {
	guid: string;
	firstName: string;
	lastName: string;
	email: string;
	isActive: boolean;
	code?: string;
}

export interface VismaCustomer {
	guid: string;
	name: string;
	isActive: boolean;
	number?: string;
}

export interface VismaProject {
	guid: string;
	name: string;
	customerGuid: string;
	isClosed: boolean;
	projectNumber?: string;
}

export interface VismaPhase {
	guid: string;
	name: string;
	projectGuid: string;
	isCompleted: boolean;
	isLocked: boolean;
}

export interface VismaWorkType {
	guid: string;
	name: string;
	isActive: boolean;
	code?: string;
}

export interface VismaWorkHour {
	guid?: string;
	userGuid: string;
	phaseGuid: string;
	workTypeGuid: string;
	startTime: string; // ISO 8601
	endTime: string; // ISO 8601
	quantity?: number; // hours as decimal
	description?: string;
	overtimeGuid?: string;
}

export interface VismaListResponse<T> {
	data: T[];
	totalCount?: number;
	hasMoreRows?: boolean;
}

/**
 * Visma Severa REST API client
 */
class VismaClient {
	private apiKey: string | null = null;
	private clientId: string | null = null;
	private clientSecret: string | null = null;
	private accessToken: string | null = null;
	private tokenExpiresAt: Date | null = null;

	constructor() {
		this.apiKey = env.VISMA_API_KEY || null;
		this.clientId = env.VISMA_CLIENT_ID || null;
		this.clientSecret = env.VISMA_CLIENT_SECRET || null;
	}

	private async getAccessToken(): Promise<string> {
		// If we have a valid token, return it
		if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
			return this.accessToken;
		}

		// If API key is configured, use it directly
		if (this.apiKey) {
			return this.apiKey;
		}

		// Otherwise, use OAuth2 client credentials flow
		if (!this.clientId || !this.clientSecret) {
			throw new Error("Visma API credentials not configured");
		}

		const response = await fetch(`${VISMA_BASE_URL}/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: this.clientId,
				client_secret: this.clientSecret,
				scope: "customers:read projects:read phases:read worktypes:read users:read workhours:read workhours:write"
			})
		});

		if (!response.ok) {
			throw new Error(`Visma OAuth error: ${response.status}`);
		}

		const data = await response.json();
		this.accessToken = data.access_token;
		this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

		return this.accessToken!;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const token = await this.getAccessToken();

		const response = await fetch(`${VISMA_BASE_URL}${endpoint}`, {
			...options,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				...options.headers
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Visma API error ${response.status}: ${errorText}`);
		}

		return response.json();
	}

	/**
	 * Paginated fetch helper
	 */
	private async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
		const allItems: T[] = [];
		let firstRow = 0;
		const rowCount = 100;
		let hasMore = true;

		while (hasMore) {
			const queryParams = new URLSearchParams({
				...params,
				firstRow: String(firstRow),
				rowCount: String(rowCount)
			});

			const response = await this.request<T[]>(`${endpoint}?${queryParams}`);

			allItems.push(...response);
			hasMore = response.length === rowCount;
			firstRow += rowCount;
		}

		return allItems;
	}

	// User endpoints
	async getUsers(): Promise<VismaUser[]> {
		return this.fetchAll<VismaUser>("/users");
	}

	async getUser(guid: string): Promise<VismaUser> {
		return this.request<VismaUser>(`/users/${guid}`);
	}

	// Customer/Account endpoints
	async getCustomers(changedSince?: Date): Promise<VismaCustomer[]> {
		const params: Record<string, string> = {};
		if (changedSince) {
			params.changedSince = changedSince.toISOString();
		}
		return this.fetchAll<VismaCustomer>("/customers", params);
	}

	async getCustomer(guid: string): Promise<VismaCustomer> {
		return this.request<VismaCustomer>(`/customers/${guid}`);
	}

	// Project/Case endpoints
	async getProjects(changedSince?: Date): Promise<VismaProject[]> {
		const params: Record<string, string> = {};
		if (changedSince) {
			params.changedSince = changedSince.toISOString();
		}
		return this.fetchAll<VismaProject>("/projects", params);
	}

	async getProject(guid: string): Promise<VismaProject> {
		return this.request<VismaProject>(`/projects/${guid}`);
	}

	// Phase endpoints
	async getPhases(projectGuid?: string): Promise<VismaPhase[]> {
		const params: Record<string, string> = {};
		if (projectGuid) {
			params.projectGuid = projectGuid;
		}
		return this.fetchAll<VismaPhase>("/phases", params);
	}

	async getPhase(guid: string): Promise<VismaPhase> {
		return this.request<VismaPhase>(`/phases/${guid}`);
	}

	// Work type endpoints
	async getWorkTypes(): Promise<VismaWorkType[]> {
		return this.fetchAll<VismaWorkType>("/worktypes");
	}

	async getWorkType(guid: string): Promise<VismaWorkType> {
		return this.request<VismaWorkType>(`/worktypes/${guid}`);
	}

	// Work hours endpoints
	async getWorkHours(params: {
		userGuid?: string;
		startDate?: Date;
		endDate?: Date;
	}): Promise<VismaWorkHour[]> {
		const queryParams: Record<string, string> = {};
		if (params.userGuid) queryParams.userGuid = params.userGuid;
		if (params.startDate) queryParams.startDate = params.startDate.toISOString().split("T")[0];
		if (params.endDate) queryParams.endDate = params.endDate.toISOString().split("T")[0];

		return this.fetchAll<VismaWorkHour>("/workhours", queryParams);
	}

	async createWorkHour(data: Omit<VismaWorkHour, "guid">): Promise<VismaWorkHour> {
		return this.request<VismaWorkHour>("/workhours", {
			method: "POST",
			body: JSON.stringify(data)
		});
	}

	async updateWorkHour(guid: string, data: Partial<VismaWorkHour>): Promise<VismaWorkHour> {
		return this.request<VismaWorkHour>(`/workhours/${guid}`, {
			method: "PATCH",
			body: JSON.stringify(data)
		});
	}

	async deleteWorkHour(guid: string): Promise<void> {
		await this.request<void>(`/workhours/${guid}`, {
			method: "DELETE"
		});
	}
}

// Export singleton instance
export const vismaClient = new VismaClient();

// Export types for import service
export type { VismaClient };
