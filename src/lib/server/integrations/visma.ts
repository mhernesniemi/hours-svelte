import { env } from "$env/dynamic/private";

// Base URL for Visma Severa REST API (default: production, use VISMA_BASE_URL env var for staging)
const VISMA_BASE_URL = env.VISMA_BASE_URL || "https://api.severa.visma.com/rest-api/v1.0";

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
	customer?: {
		guid: string;
		name?: string;
		number?: number;
	};
	isClosed: boolean;
	projectNumber?: string;
}

export interface VismaPhase {
	guid: string;
	name: string;
	projectGuid?: string; // Optional - API may not always return this
	project?: {
		guid: string;
		name?: string;
	};
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
			console.log("[Visma] Using API key for authentication");
			return this.apiKey;
		}

		// Otherwise, use OAuth2 client credentials flow
		if (!this.clientId || !this.clientSecret) {
			throw new Error("Visma API credentials not configured");
		}

		console.log("[Visma] Requesting new OAuth token...");

		// Visma Severa expects client_Id and client_Secret in request body (note the casing!)
		// Also need to request scopes explicitly
		const scopes = [
			"users:read",
			"customers:read",
			"projects:read",
			"projects:write",
			"activities:read",
			"activities:write",
			"hours:read",
			"hours:write",
			"hours:delete",
			"settings:read",
			"organization:read"
		].join(" ");

		const response = await fetch(`${VISMA_BASE_URL}/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_Id: this.clientId,
				client_Secret: this.clientSecret,
				scope: scopes
			})
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error("[Visma] OAuth error:", response.status, errorBody);
			throw new Error(`Visma OAuth error ${response.status}: ${errorBody}`);
		}

		const data = await response.json();
		this.accessToken = data.access_token;
		// Default to 1 hour if expires_in is not provided or is 0
		const expiresIn = data.expires_in || 3600;
		this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);

		console.log(`[Visma] OAuth token obtained, expires in ${expiresIn}s`);
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
	 * Paginated fetch helper - uses 500 items per page for efficiency
	 */
	private async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
		const allItems: T[] = [];
		let firstRow = 0;
		const rowCount = 500; // Increased from 100 for faster fetching
		let hasMore = true;
		let pageCount = 0;

		console.log(`[Visma] Starting paginated fetch for ${endpoint}`);

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
			pageCount++;

			console.log(`[Visma] Page ${pageCount}: ${allItems.length} items total`);
		}

		console.log(`[Visma] Completed ${endpoint}: ${allItems.length} total items`);
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
