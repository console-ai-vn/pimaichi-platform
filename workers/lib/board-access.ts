import { normalizeEmail, normalizeEmailList } from "./access";
import { getDomainConfig } from "./admin";
import { getMailboxStub } from "./email-helpers";
import {
	getBoardMeta,
	isPlatformAdmin,
	loadMailboxSettings,
} from "./board-settings";
import {
	resolveMailboxRole,
	type LegacyAccessOptions,
	type MailboxRole,
} from "./permissions";
import type { Env } from "../types";

export async function resolveBoardAccessRole(
	env: Env,
	accessEmail: string,
	boardMailboxId: string,
	accessOptions: LegacyAccessOptions,
	getExplicitRole: (email: string) => Promise<MailboxRole | null>,
	settings?: Record<string, unknown>,
): Promise<MailboxRole | null> {
	const role = await resolveMailboxRole(
		accessEmail,
		boardMailboxId,
		accessOptions,
		getExplicitRole,
	);
	if (role) return role;

	const mailboxSettings =
		settings ?? (await loadMailboxSettings(env.BUCKET, boardMailboxId));
	if (!getBoardMeta(mailboxSettings).isPublicBoard) return null;

	const config = await getDomainConfig(env);
	if (isPlatformAdmin(accessEmail, config.accessEmailAddresses)) {
		return "admin";
	}

	return null;
}

export async function seedMailboxTeamAccess(
	env: Env,
	boardMailboxId: string,
	grantedBy: string,
) {
	const config = await getDomainConfig(env);
	const boardEmail = normalizeEmail(boardMailboxId);
	const stub = getMailboxStub(env, boardMailboxId);
	const teamEmails = new Set([
		...normalizeEmailList(config.emailAddresses),
		...normalizeEmailList(config.accessEmailAddresses),
	]);
	teamEmails.delete(boardEmail);

	for (const email of teamEmails) {
		const existing = await stub.getExplicitMailboxRole(email);
		if (existing) continue;
		const isOrgAdmin = normalizeEmailList(config.accessEmailAddresses).includes(
			email,
		);
		await stub.grantMailboxPermission(
			email,
			isOrgAdmin ? "manager" : "member",
			grantedBy,
		);
	}
}