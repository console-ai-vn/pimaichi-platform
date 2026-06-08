// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	is_deletable: integer("is_deletable").notNull().default(1),
});

export const emails = sqliteTable("emails", {
	id: text("id").primaryKey(),
	folder_id: text("folder_id")
		.notNull()
		.references(() => folders.id, { onDelete: "cascade" }),
	subject: text("subject"),
	sender: text("sender"),
	recipient: text("recipient"),
	cc: text("cc"),
	bcc: text("bcc"),
	date: text("date"),
	read: integer("read").default(0),
	starred: integer("starred").default(0),
	body: text("body"),
	in_reply_to: text("in_reply_to"),
	email_references: text("email_references"),
	thread_id: text("thread_id"),
	message_id: text("message_id"),
	raw_headers: text("raw_headers"),
});

export const attachments = sqliteTable("attachments", {
	id: text("id").primaryKey(),
	email_id: text("email_id")
		.notNull()
		.references(() => emails.id, { onDelete: "cascade" }),
	filename: text("filename").notNull(),
	mimetype: text("mimetype").notNull(),
	size: integer("size").notNull(),
	content_id: text("content_id"),
	disposition: text("disposition"),
});

export const contacts = sqliteTable(
	"contacts",
	{
		id: text("id").primaryKey(),
		email: text("email").notNull(),
		display_name: text("display_name"),
		bio: text("bio"),
		contact_description: text("contact_description"),
		relationship: text("relationship"),
		relationship_stage: text("relationship_stage"),
		tags: text("tags"),
		memory: text("memory"),
		location: text("location"),
		website: text("website"),
		first_seen_at: text("first_seen_at").notNull(),
		last_seen_at: text("last_seen_at").notNull(),
		updated_at: text("updated_at"),
		blocked: integer("blocked").notNull().default(0),
	},
	(table) => [uniqueIndex("idx_contacts_email").on(table.email)],
);

export const conversationParticipants = sqliteTable(
	"conversation_participants",
	{
		thread_id: text("thread_id").notNull(),
		contact_id: text("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		first_seen_at: text("first_seen_at").notNull(),
		last_seen_at: text("last_seen_at").notNull(),
	},
	(table) => [
		index("idx_conversation_participants_thread").on(table.thread_id),
		uniqueIndex("idx_conversation_participants_thread_contact").on(
			table.thread_id,
			table.contact_id,
		),
	],
);

export const conversationState = sqliteTable("conversation_state", {
	thread_id: text("thread_id").primaryKey(),
	assignee_email: text("assignee_email"),
	status: text("status").notNull().default("open"),
	priority: text("priority").notNull().default("normal"),
	needs_reply: integer("needs_reply").notNull().default(0),
	last_seen_at: text("last_seen_at"),
	updated_at: text("updated_at").notNull(),
});

export const internalNotes = sqliteTable(
	"internal_notes",
	{
		id: text("id").primaryKey(),
		thread_id: text("thread_id").notNull(),
		author_email: text("author_email").notNull(),
		body: text("body").notNull(),
		created_at: text("created_at").notNull(),
		updated_at: text("updated_at").notNull(),
	},
	(table) => [index("idx_internal_notes_thread").on(table.thread_id, table.created_at)],
);

export const conversationEvents = sqliteTable(
	"conversation_events",
	{
		id: text("id").primaryKey(),
		thread_id: text("thread_id").notNull(),
		type: text("type").notNull(),
		actor_email: text("actor_email"),
		payload: text("payload"),
		created_at: text("created_at").notNull(),
	},
	(table) => [index("idx_conversation_events_thread").on(table.thread_id, table.created_at)],
);

export const auditLog = sqliteTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		actor_email: text("actor_email").notNull(),
		action: text("action").notNull(),
		target_type: text("target_type").notNull(),
		target_id: text("target_id").notNull(),
		payload: text("payload"),
		created_at: text("created_at").notNull(),
	},
	(table) => [
		index("idx_audit_log_created_at").on(table.created_at),
		index("idx_audit_log_action").on(table.action),
		index("idx_audit_log_actor").on(table.actor_email),
	],
);

export const mailboxPermissions = sqliteTable(
	"mailbox_permissions",
	{
		user_email: text("user_email").notNull().primaryKey(),
		role: text("role").notNull(),
		granted_by: text("granted_by").notNull(),
		granted_at: text("granted_at").notNull(),
	},
	(table) => [index("idx_mailbox_permissions_role").on(table.role)],
);
