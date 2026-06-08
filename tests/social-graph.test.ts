import assert from "node:assert/strict";
import test from "node:test";
import {
	extractSocialParticipants,
	normalizeSocialEmailAddress,
	socialContactIdForEmail,
} from "../workers/lib/social-graph.ts";
import { mailboxMigrations } from "../workers/durableObject/migrations.ts";

test("normalizeSocialEmailAddress lowercases and extracts angle-bracket addresses", () => {
	assert.equal(
		normalizeSocialEmailAddress("  Alice Example <Alice@Example.COM> "),
		"alice@example.com",
	);
});

test("extractSocialParticipants de-duplicates sender recipient cc and bcc addresses", () => {
	const participants = extractSocialParticipants({
		sender: "Alice <alice@example.com>",
		recipient: "Bob <bob@example.com>, Alice <ALICE@example.com>",
		cc: "carol@example.com",
		bcc: "Bob <bob@example.com>",
	});

	assert.deepEqual(participants, [
		"alice@example.com",
		"bob@example.com",
		"carol@example.com",
	]);
});

test("socialContactIdForEmail is deterministic from the normalized email", () => {
	assert.equal(
		socialContactIdForEmail("Alice@Example.COM"),
		"contact:alice@example.com",
	);
});

test("mailbox migrations include social graph tables", () => {
	const socialMigration = mailboxMigrations.find(
		(migration) => migration.name === "9_add_social_graph",
	);

	assert.ok(socialMigration);
	assert.match(socialMigration.sql, /CREATE TABLE IF NOT EXISTS contacts/i);
	assert.match(
		socialMigration.sql,
		/CREATE TABLE IF NOT EXISTS conversation_participants/i,
	);
	assert.match(
		socialMigration.sql,
		/CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email/i,
	);
	assert.match(
		socialMigration.sql,
		/CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_participants_thread_contact/i,
	);
});

test("mailbox migrations include editable contact profile fields", () => {
	const profileMigration = mailboxMigrations.find(
		(migration) => migration.name === "12_add_contact_profile_fields",
	);

	assert.ok(profileMigration);
	assert.match(profileMigration.sql, /ALTER TABLE contacts ADD COLUMN bio TEXT/i);
	assert.match(
		profileMigration.sql,
		/ALTER TABLE contacts ADD COLUMN contact_description TEXT/i,
	);
	assert.match(profileMigration.sql, /ALTER TABLE contacts ADD COLUMN website TEXT/i);
});

test("mailbox migrations include contact memory fields", () => {
	const memoryMigration = mailboxMigrations.find(
		(migration) => migration.name === "13_add_contact_memory_fields",
	);

	assert.ok(memoryMigration);
	assert.match(
		memoryMigration.sql,
		/ALTER TABLE contacts ADD COLUMN relationship_stage TEXT/i,
	);
	assert.match(memoryMigration.sql, /ALTER TABLE contacts ADD COLUMN tags TEXT/i);
	assert.match(memoryMigration.sql, /ALTER TABLE contacts ADD COLUMN memory TEXT/i);
});

test("mailbox migrations include contact blocked field", () => {
	const blockedMigration = mailboxMigrations.find(
		(migration) => migration.name === "16_add_contact_blocked",
	);

	assert.ok(blockedMigration);
	assert.match(blockedMigration.sql, /ALTER TABLE contacts ADD COLUMN blocked INTEGER/i);
});
