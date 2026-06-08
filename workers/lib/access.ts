export class AccessAuthorizationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AccessAuthorizationError";
	}
}

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function getAccessEmail(payload: Record<string, unknown>): string {
	const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
	if (!email) {
		throw new AccessAuthorizationError("Cloudflare Access JWT is missing an email claim");
	}
	return email;
}

export function assertMailboxAccess(
	accessEmail: string,
	mailboxId: string,
	options: {
		allowMissingIdentity?: boolean;
		allowedMailboxIds?: string[];
		allowedAccessEmails?: string[];
	} = {},
) {
	const normalizedAccessEmail = normalizeEmail(accessEmail);
	const normalizedMailboxId = normalizeEmail(mailboxId);
	const allowedMailboxIds = normalizeEmailList(options.allowedMailboxIds ?? []);
	const allowedAccessEmails = normalizeEmailList(options.allowedAccessEmails ?? []);

	if (!normalizedAccessEmail && options.allowMissingIdentity) return;

	if (!normalizedAccessEmail) {
		throw new AccessAuthorizationError("You do not have access to this mailbox");
	}

	const isDirectMailboxOwner = normalizedAccessEmail === normalizedMailboxId;
	const isPlatformAdmin = allowedAccessEmails.includes(normalizedAccessEmail);

	if (!isDirectMailboxOwner && !isPlatformAdmin) {
		throw new AccessAuthorizationError("You do not have access to this mailbox");
	}
}

export function filterMailboxIdsForAccess(
	mailboxIds: string[],
	accessEmail: string,
	options: {
		allowMissingIdentity?: boolean;
		allowedMailboxIds?: string[];
		allowedAccessEmails?: string[];
	} = {},
) {
	const normalizedAccessEmail = normalizeEmail(accessEmail);
	if (!normalizedAccessEmail && options.allowMissingIdentity) return mailboxIds;
	if (!normalizedAccessEmail) return [];

	const allowedMailboxIds = normalizeEmailList(options.allowedMailboxIds ?? []);
	const allowedAccessEmails = normalizeEmailList(options.allowedAccessEmails ?? []);

	if (allowedAccessEmails.includes(normalizedAccessEmail)) {
		return mailboxIds;
	}

	return mailboxIds.filter(
		(mailboxId) => normalizeEmail(mailboxId) === normalizedAccessEmail,
	);
}

export function normalizeEmailList(values: readonly string[]) {
	return values.map(normalizeEmail).filter(Boolean);
}
