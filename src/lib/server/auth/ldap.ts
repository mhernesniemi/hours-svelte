import { Client, type SearchResult } from "ldapts";
import { env } from "$env/dynamic/private";

export interface LdapUser {
	email: string;
	firstName: string;
	lastName: string;
	ldapDn: string;
}

/**
 * Authenticate a user against LDAP and return their profile data.
 * Returns null if authentication fails.
 */
export async function authenticateLdap(
	username: string,
	password: string
): Promise<LdapUser | null> {
	const ldapUrl = env.LDAP_URL;
	const ldapBindDn = env.LDAP_BIND_DN;
	const ldapBindPassword = env.LDAP_BIND_PASSWORD;
	const ldapBaseDn = env.LDAP_BASE_DN;

	if (!ldapUrl || !ldapBindDn || !ldapBindPassword || !ldapBaseDn) {
		console.error("LDAP configuration missing");
		return null;
	}

	const client = new Client({
		url: ldapUrl,
		timeout: 10000,
		connectTimeout: 10000
	});

	try {
		// 1. Bind as service account to search for the user
		await client.bind(ldapBindDn, ldapBindPassword);

		// 2. Find user by sAMAccountName (Windows AD) or uid
		const { searchEntries }: SearchResult = await client.search(ldapBaseDn, {
			scope: "sub",
			filter: `(|(sAMAccountName=${escapeFilter(username)})(uid=${escapeFilter(username)}))`,
			attributes: ["dn", "mail", "givenName", "sn", "displayName"]
		});

		if (searchEntries.length !== 1) {
			console.log(
				`LDAP: User ${username} not found or ambiguous (${searchEntries.length} results)`
			);
			return null;
		}

		const userEntry = searchEntries[0];
		const userDn = userEntry.dn;

		// 3. Verify user credentials by binding as the user
		await client.unbind();

		const userClient = new Client({
			url: ldapUrl,
			timeout: 10000,
			connectTimeout: 10000
		});

		try {
			await userClient.bind(userDn, password);
			await userClient.unbind();
		} catch (bindError) {
			console.log(`LDAP: Invalid credentials for user ${username}`);
			console.log(`LDAP: Bind error details:`, bindError);
			return null;
		}

		// 4. Extract user data
		const email = extractAttribute(userEntry, "mail");
		const givenName = extractAttribute(userEntry, "givenName");
		const sn = extractAttribute(userEntry, "sn");
		const displayName = extractAttribute(userEntry, "displayName");

		// Parse name from displayName if givenName/sn not available
		let firstName = givenName;
		let lastName = sn;

		if (!firstName && !lastName && displayName) {
			const parts = displayName.split(" ");
			firstName = parts[0] || "";
			lastName = parts.slice(1).join(" ") || "";
		}

		if (!email) {
			console.error(`LDAP: User ${username} has no email attribute`);
			return null;
		}

		return {
			email: email.toLowerCase(),
			firstName: firstName || "",
			lastName: lastName || "",
			ldapDn: userDn
		};
	} catch (error) {
		console.error("LDAP authentication error:", error);
		return null;
	} finally {
		try {
			await client.unbind();
		} catch {
			// Ignore unbind errors
		}
	}
}

/**
 * Escape special characters in LDAP filter values
 */
function escapeFilter(value: string): string {
	return value
		.replace(/\\/g, "\\5c")
		.replace(/\*/g, "\\2a")
		.replace(/\(/g, "\\28")
		.replace(/\)/g, "\\29")
		.replace(/\x00/g, "\\00");
}

/**
 * Extract a single attribute value from an LDAP entry
 */
function extractAttribute(
	entry: Record<string, string | string[] | Buffer | Buffer[]>,
	name: string
): string | undefined {
	const value = entry[name];
	if (!value) return undefined;
	if (Array.isArray(value)) {
		const first = value[0];
		return Buffer.isBuffer(first) ? first.toString() : first;
	}
	return Buffer.isBuffer(value) ? value.toString() : value;
}
