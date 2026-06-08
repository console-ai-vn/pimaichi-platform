import type { DomainConfig } from "./admin";
import type { Env } from "../types";

function normalizeSignupEmail(value: string) {
	return value.trim().toLowerCase();
}

export interface AccessOtpAutomationConfig {
	accountId: string;
	listId: string;
	apiToken: string;
	apiEmail?: string;
}

function buildCloudflareAuthHeaders(
	apiToken: string,
	apiEmail?: string,
): Record<string, string> {
	if (apiToken.startsWith("cfk_")) {
		const email = apiEmail?.trim() || "";
		if (!email) {
			throw new Error("CF_API_EMAIL is required when using a Global API Key");
		}
		return {
			"X-Auth-Key": apiToken,
			"X-Auth-Email": email,
			"Content-Type": "application/json",
		};
	}
	return {
		Authorization: `Bearer ${apiToken}`,
		"Content-Type": "application/json",
	};
}

export interface AppendEmailResult {
	added: boolean;
	skipped: boolean;
	error?: string;
}

export function resolveAccessOtpAutomation(
	env: Env,
	domainConfig: DomainConfig,
): AccessOtpAutomationConfig | null {
	const accountId = domainConfig.cfAccountId?.trim() || env.CF_ACCOUNT_ID?.trim() || "";
	const listId =
		domainConfig.accessOtpListId?.trim() || env.ACCESS_OTP_LIST_ID?.trim() || "";
	const apiToken = env.CF_API_TOKEN?.trim() || "";
	const apiEmail = env.CF_API_EMAIL?.trim() || "";
	if (!accountId || !listId || !apiToken) return null;
	if (apiToken.startsWith("cfk_") && !apiEmail) return null;
	return { accountId, listId, apiToken, ...(apiEmail ? { apiEmail } : {}) };
}

export function buildListAppendBody(email: string, description: string) {
	return {
		append: [
			{
				value: normalizeSignupEmail(email),
				description: description.slice(0, 500),
			},
		],
	};
}

export async function appendEmailToZeroTrustList(
	config: AccessOtpAutomationConfig,
	email: string,
	description: string,
): Promise<AppendEmailResult> {
	const normalized = normalizeSignupEmail(email);
	const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/gateway/lists/${encodeURIComponent(config.listId)}`;
	const response = await fetch(url, {
		method: "PATCH",
		headers: buildCloudflareAuthHeaders(config.apiToken, config.apiEmail),
		body: JSON.stringify(buildListAppendBody(normalized, description)),
	});
	let payload: { success?: boolean; errors?: Array<{ message?: string }> } = {};
	try {
		payload = (await response.json()) as typeof payload;
	} catch {
		payload = {};
	}
	if (!response.ok || payload.success === false) {
		const message =
			payload.errors?.map((entry) => entry.message).filter(Boolean).join("; ") ||
			`Cloudflare list update failed (${response.status})`;
		if (/duplicate|already exists/i.test(message)) {
			return { added: false, skipped: true };
		}
		return { added: false, skipped: false, error: message };
	}
	return { added: true, skipped: false };
}