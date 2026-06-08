import assert from "node:assert/strict";
import test from "node:test";

type MailboxRole = "owner" | "admin" | "manager" | "member" | "viewer";
type MailboxPermission = "read" | "send" | "delete" | "settings" | "manage";

const ROLE_PERMISSIONS: Record<MailboxRole, readonly MailboxPermission[]> = {
	viewer: ["read"],
	member: ["read", "send"],
	manager: ["read", "send", "delete", "settings"],
	owner: ["read", "send", "delete", "settings", "manage"],
	admin: ["read", "send", "delete", "settings", "manage"],
};

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

function normalizeEmailList(values: readonly string[]) {
	return values.map(normalizeEmail).filter(Boolean);
}

function resolveLegacyRole(
	accessEmail: string,
	mailboxId: string,
	options: {
		allowMissingIdentity?: boolean;
		allowedMailboxIds?: string[];
		allowedAccessEmails?: string[];
	} = {},
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

function roleHasPermission(role: MailboxRole, permission: MailboxPermission) {
	return ROLE_PERMISSIONS[role].includes(permission);
}

function assertMailboxPermission(role: MailboxRole | null, permission: MailboxPermission) {
	if (!role || !roleHasPermission(role, permission)) {
		throw new Error(`Missing permission: ${permission}`);
	}
}

test("resolveLegacyRole treats mailbox owner as owner", () => {
	assert.equal(
		resolveLegacyRole("owner@example.com", "owner@example.com"),
		"owner",
	);
});

test("resolveLegacyRole treats ACCESS_EMAIL_ADDRESSES users as admin on any mailbox", () => {
	assert.equal(
		resolveLegacyRole("ceo@example.com", "admin@example.com", {
			allowedAccessEmails: ["ceo@example.com"],
			allowedMailboxIds: ["admin@example.com"],
		}),
		"admin",
	);
	assert.equal(
		resolveLegacyRole("ceo@example.com", "board@example.com", {
			allowedAccessEmails: ["ceo@example.com"],
			allowedMailboxIds: ["admin@example.com"],
		}),
		"admin",
	);
});

test("viewer cannot send or delete", () => {
	assert.equal(roleHasPermission("viewer", "read"), true);
	assert.equal(roleHasPermission("viewer", "send"), false);
	assert.equal(roleHasPermission("viewer", "delete"), false);
});

test("manager can send and delete but not manage permissions", () => {
	assert.equal(roleHasPermission("manager", "send"), true);
	assert.equal(roleHasPermission("manager", "delete"), true);
	assert.equal(roleHasPermission("manager", "manage"), false);
});

test("assertMailboxPermission throws for missing capability", () => {
	assert.throws(
		() => assertMailboxPermission("viewer", "send"),
		/send/i,
	);
});

test("mailbox migrations include mailbox permissions table", async () => {
	const { mailboxMigrations } = await import("../workers/durableObject/migrations.ts");
	const migration = mailboxMigrations.find((entry) => entry.name === "15_add_mailbox_permissions");
	assert.ok(migration);
	assert.match(migration?.sql ?? "", /mailbox_permissions/i);
});