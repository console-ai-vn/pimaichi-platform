export const AUDIT_ACTIONS = [
	"email.read",
	"email.send",
	"email.delete",
	"email.move",
	"draft.save",
	"mailbox.create",
	"mailbox.settings_update",
	"mailbox.avatar_update",
	"mailbox.cover_update",
	"conversation.state_update",
	"conversation.delete",
	"conversation.move",
	"note.create",
	"login.success",
	"retention.purge",
	"retention.archive",
	"mailbox.delete",
	"permission.grant",
	"permission.revoke",
	"domain.config_update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntryInput {
	actor_email: string;
	action: AuditAction;
	target_type: string;
	target_id: string;
	payload?: Record<string, unknown> | null;
}

export interface AuditListOptions {
	page?: number;
	limit?: number;
	action?: string;
	actor?: string;
	from?: string;
	to?: string;
}

export function normalizeAuditListOptions(options: AuditListOptions = {}) {
	const page = Math.max(1, options.page ?? 1);
	const limit = Math.min(Math.max(1, options.limit ?? 50), 100);
	return {
		page,
		limit,
		offset: (page - 1) * limit,
		action: options.action?.trim() || undefined,
		actor: options.actor?.trim().toLowerCase() || undefined,
		from: options.from?.trim() || undefined,
		to: options.to?.trim() || undefined,
	};
}

export function assertAuditAdminAccess(
	accessEmail: string,
	allowedAccessEmails: readonly string[],
) {
	const normalizedAccessEmail = accessEmail.trim().toLowerCase();
	const allowed = allowedAccessEmails.map((email) => email.trim().toLowerCase()).filter(Boolean);
	if (!normalizedAccessEmail || !allowed.includes(normalizedAccessEmail)) {
		throw new Error("Audit log requires admin access");
	}
}

export async function recordAudit(
	stub: { insertAuditEntry: (entry: AuditEntryInput) => unknown },
	entry: AuditEntryInput,
) {
	try {
		await stub.insertAuditEntry(entry);
	} catch (error) {
		console.error("audit write failed", error);
	}
}