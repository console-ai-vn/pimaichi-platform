import assert from "node:assert/strict";
import test from "node:test";
import {
	assertMailboxAccess,
	filterMailboxIdsForAccess,
	getAccessEmail,
} from "../workers/lib/access.ts";

test("getAccessEmail normalizes a verified Access JWT email", () => {
	assert.equal(getAccessEmail({ email: " Owner@Example.COM " }), "owner@example.com");
});

test("getAccessEmail rejects a JWT without an email claim", () => {
	assert.throws(() => getAccessEmail({ sub: "user-123" }), /email claim/i);
});

test("assertMailboxAccess allows an owner to open their mailbox", () => {
	assert.doesNotThrow(() =>
		assertMailboxAccess("owner@example.com", "OWNER@example.com"),
	);
});

test("assertMailboxAccess rejects access to another mailbox", () => {
	assert.throws(
		() => assertMailboxAccess("owner@example.com", "finance@example.com"),
		/mailbox/i,
	);
});

test("assertMailboxAccess allows configured members into shared mailboxes", () => {
	assert.doesNotThrow(() =>
		assertMailboxAccess("ceo@example.com", "admin@example.com", {
			allowedAccessEmails: ["ceo@example.com"],
			allowedMailboxIds: ["admin@example.com"],
		}),
	);
});

test("assertMailboxAccess allows platform admins into any mailbox", () => {
	assert.doesNotThrow(() =>
		assertMailboxAccess("ceo@example.com", "finance@example.com", {
			allowedAccessEmails: ["ceo@example.com"],
			allowedMailboxIds: ["admin@example.com"],
		}),
	);
});

test("filterMailboxIdsForAccess exposes only the signed-in mailbox", () => {
	assert.deepEqual(
		filterMailboxIdsForAccess(
			["owner@example.com", "finance@example.com"],
			"OWNER@example.com",
		),
		["owner@example.com"],
	);
});

test("filterMailboxIdsForAccess exposes every mailbox to platform admins", () => {
	assert.deepEqual(
		filterMailboxIdsForAccess(
			["admin@example.com", "finance@example.com"],
			"ceo@example.com",
			{
				allowedAccessEmails: ["ceo@example.com"],
				allowedMailboxIds: ["admin@example.com"],
			},
		),
		["admin@example.com", "finance@example.com"],
	);
});

test("filterMailboxIdsForAccess keeps local development usable without identity", () => {
	assert.deepEqual(
		filterMailboxIdsForAccess(
			["owner@example.com", "finance@example.com"],
			"",
			{ allowMissingIdentity: true },
		),
		["owner@example.com", "finance@example.com"],
	);
});
