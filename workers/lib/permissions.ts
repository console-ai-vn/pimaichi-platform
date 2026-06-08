import {
	assertMailboxAccess,
	AccessAuthorizationError,
	normalizeEmail,
	normalizeEmailList,
} from "./access";

export const MAILBOX_ROLES = [
	"owner",
	"admin",
	"manager",
	"member",
	"viewer",
] as const;

export type MailboxRole = (typeof MAILBOX_ROLES)[number];

export const ROLE_RANK: Record<MailboxRole, number> = {
	viewer: 1,
	member: 2,
	manager: 3,
	owner: 4,
	admin: 5,
};

export type MailboxPermission = "read" | "send" | "delete" | "settings" | "manage";

const ROLE_PERMISSIONS: Record<MailboxRole, readonly MailboxPermission[]> = {
	viewer: ["read"],
	member: ["read", "send"],
	manager: ["read", "send", "delete", "settings"],
	owner: ["read", "send", "delete", "settings", "manage"],
	admin: ["read", "send", "delete", "settings", "manage"],
};

export class PermissionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PermissionError";
	}
}

export interface LegacyAccessOptions {
	allowMissingIdentity?: boolean;
	allowedMailboxIds?: string[];
	allowedAccessEmails?: string[];
}

export function resolveLegacyRole(
	accessEmail: string,
	mailboxId: string,
	options: LegacyAccessOptions = {},
): MailboxRole | null {
	const normalizedAccessEmail = normalizeEmail(accessEmail);
	const normalizedMailboxId = normalizeEmail(mailboxId);
	const allowedMailboxIds = normalizeEmailList(options.allowedMailboxIds ?? []);
	const allowedAccessEmails = normalizeEmailList(options.allowedAccessEmails ?? []);

	if (!normalizedAccessEmail && options.allowMissingIdentity) return "admin";
	if (!normalizedAccessEmail) return null;

	if (allowedAccessEmails.includes(normalizedAccessEmail)) {
		return "admin";
	}

	if (normalizedAccessEmail === normalizedMailboxId) return "owner";
	return null;
}

export function roleHasPermission(role: MailboxRole, permission: MailboxPermission) {
	return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertMailboxPermission(role: MailboxRole | null, permission: MailboxPermission) {
	if (!role || !roleHasPermission(role, permission)) {
		throw new PermissionError(`Missing permission: ${permission}`);
	}
}

export async function resolveMailboxRole(
	accessEmail: string,
	mailboxId: string,
	options: LegacyAccessOptions,
	getExplicitRole?: (userEmail: string) => Promise<MailboxRole | null>,
): Promise<MailboxRole | null> {
	const legacyRole = resolveLegacyRole(accessEmail, mailboxId, options);
	if (legacyRole) return legacyRole;

	if (!getExplicitRole) return null;
	const explicitRole = await getExplicitRole(normalizeEmail(accessEmail));
	return explicitRole;
}

export function assertMailboxReadAccess(
	accessEmail: string,
	mailboxId: string,
	options: LegacyAccessOptions,
) {
	try {
		assertMailboxAccess(accessEmail, mailboxId, options);
	} catch (error) {
		if (error instanceof AccessAuthorizationError) {
			throw new PermissionError(error.message);
		}
		throw error;
	}
}