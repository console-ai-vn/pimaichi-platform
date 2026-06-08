import { normalizeEmail, normalizeEmailList } from "./access";
import { getDomainConfig, type DomainConfig } from "./admin";
import type { Env } from "../types";

export class HomeFeedAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HomeFeedAccessError";
	}
}

export function isOrgMember(accessEmail: string, config: DomainConfig): boolean {
	const normalized = normalizeEmail(accessEmail);
	if (!normalized) return false;
	const team = new Set([
		...normalizeEmailList(config.emailAddresses),
		...normalizeEmailList(config.accessEmailAddresses),
	]);
	return team.has(normalized);
}

export async function assertOrgMemberAccess(
	env: Env,
	accessEmail: string,
	allowMissingIdentity = import.meta.env.DEV,
) {
	if (!accessEmail && allowMissingIdentity) return;
	if (!accessEmail) {
		throw new HomeFeedAccessError("You must be signed in to use Home");
	}
	const config = await getDomainConfig(env);
	if (!isOrgMember(accessEmail, config)) {
		throw new HomeFeedAccessError("You are not a member of this organization");
	}
}

export async function assertHomeFeedAdmin(env: Env, accessEmail: string) {
	const config = await getDomainConfig(env);
	const normalized = normalizeEmail(accessEmail);
	const admins = normalizeEmailList(config.accessEmailAddresses);
	if (!normalized || !admins.includes(normalized)) {
		throw new HomeFeedAccessError("Admin access required to create topics");
	}
}

export function sanitizeFeedHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.trim();
}