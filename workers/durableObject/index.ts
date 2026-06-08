// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { eq, and, or, asc, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import * as schema from "../db/schema";
import { Folders } from "../../shared/folders";
import type { Env } from "../types";
import { applyMigrations, mailboxMigrations } from "./migrations";
import {
	extractSocialParticipants,
	normalizeSocialEmailAddress,
	socialContactIdForEmail,
} from "../lib/social-graph";
import type { ConversationStatePatch } from "../lib/conversation-state";
import type { ConversationEventType } from "../lib/internal-notes";
import type { AuditEntryInput, AuditListOptions } from "../lib/audit";
import { normalizeAuditListOptions } from "../lib/audit";
import { MAILBOX_ROLES, type MailboxRole } from "../lib/permissions";
import {
	getRetentionCutoffs,
	RETENTION_ALARM_MS,
	RETENTION_BATCH_SIZE,
	TRASH_RETENTION_DAYS,
	SENT_ARCHIVE_DAYS,
	type RetentionPolicyOptions,
	type RetentionRunResult,
} from "../lib/retention";

/**
 * SQL expression to normalize email subjects by stripping common
 * reply/forward prefixes (Re:, Fwd:, FW:, AW:, WG:, Réf:, SV:).
 * Used for conversation grouping. Hardcoded to the `subject` column.
 */
const NORMALIZED_SUBJECT_SQL = `LOWER(TRIM(
	REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
		LOWER(subject),
		'aw: ', ''), 'wg: ', ''), 'réf: ', ''), 'sv: ', ''),
		're: ', ''), 'fwd: ', ''), 'fw: ', '')
))`;

/** Inbox merges active outbound threads (latest message still in sent). */
const INBOX_ACTIVE_FOLDERS_SQL = `(
	(SELECT id FROM folders WHERE name = '${Folders.INBOX}' OR id = '${Folders.INBOX}' LIMIT 1),
	(SELECT id FROM folders WHERE name = '${Folders.SENT}' OR id = '${Folders.SENT}' LIMIT 1)
)`;

const ALLOWED_SORT_COLUMNS = [
	"id",
	"subject",
	"sender",
	"recipient",
	"date",
	"read",
	"starred",
] as const;

type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

/**
 * Map SortColumn string names to Drizzle column references for safe
 * ORDER BY construction (no string interpolation into SQL).
 */
const SORT_COLUMN_MAP = {
	id: schema.emails.id,
	subject: schema.emails.subject,
	sender: schema.emails.sender,
	recipient: schema.emails.recipient,
	date: schema.emails.date,
	read: schema.emails.read,
	starred: schema.emails.starred,
} satisfies Record<SortColumn, typeof schema.emails[keyof typeof schema.emails]>;

interface SearchFilterOptions {
	query: string;
	folder?: string;
	from?: string;
	to?: string;
	subject?: string;
	date_start?: string;
	date_end?: string;
	is_read?: boolean;
	is_starred?: boolean;
	has_attachment?: boolean;
}

interface GetEmailsOptions {
	folder?: string;
	thread_id?: string;
	page?: number;
	limit?: number;
	sortColumn?: SortColumn;
	sortDirection?: "ASC" | "DESC";
}

interface EmailData {
	id: string;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string | null;
	bcc?: string | null;
	date: string;
	body: string;
	read?: boolean;
	starred?: boolean;
	in_reply_to?: string | null;
	email_references?: string | null;
	thread_id?: string | null;
	message_id?: string | null;
	raw_headers?: string | null;
}

interface AttachmentData {
	id: string;
	email_id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string | null;
	disposition?: string | null;
}

export class MailboxDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never;
	db: ReturnType<typeof drizzle>;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.db = drizzle(this.ctx.storage, { schema });
		applyMigrations(this.ctx.storage.sql, mailboxMigrations, this.ctx.storage);
		this.ctx.blockConcurrencyWhile(async () => {
			const alarm = await this.ctx.storage.getAlarm();
			if (alarm === null) {
				await this.ctx.storage.setAlarm(Date.now() + RETENTION_ALARM_MS);
			}
		});
	}

	async alarm() {
		try {
			await this.runRetention("system");
		} catch (error) {
			console.error("retention alarm failed", error);
		} finally {
			await this.ctx.storage.setAlarm(Date.now() + RETENTION_ALARM_MS);
		}
	}

	// ── Email CRUD (Drizzle) ───────────────────────────────────────

	async getEmails(options: GetEmailsOptions = {}) {
		const {
			folder,
			thread_id,
			page = 1,
			limit: rawLimit = 25,
			sortColumn: rawSortColumn = "date",
			sortDirection = "DESC",
		} = options;

		// Cap pagination limit to prevent unbounded queries
		const limit = Math.min(Math.max(rawLimit, 1), 100);

		const sortColumn: SortColumn = ALLOWED_SORT_COLUMNS.includes(
			rawSortColumn as SortColumn,
		)
			? rawSortColumn
			: "date";

		const offset = (page - 1) * limit;

		const conditions: SQL[] = [];
		if (folder) {
			conditions.push(
				sql`${schema.emails.folder_id} = (SELECT id FROM folders WHERE name = ${folder} OR id = ${folder} LIMIT 1)`,
			);
		}
		if (thread_id) {
			conditions.push(eq(schema.emails.thread_id, thread_id));
		}

		const orderCol = SORT_COLUMN_MAP[sortColumn];
		const orderDir = sortDirection === "ASC" ? asc(orderCol) : desc(orderCol);

		const result = this.db
			.select({
				id: schema.emails.id,
				subject: schema.emails.subject,
				sender: schema.emails.sender,
				recipient: schema.emails.recipient,
				cc: schema.emails.cc,
				bcc: schema.emails.bcc,
				date: schema.emails.date,
				read: schema.emails.read,
				starred: schema.emails.starred,
				in_reply_to: schema.emails.in_reply_to,
				email_references: schema.emails.email_references,
				thread_id: schema.emails.thread_id,
				folder_id: schema.emails.folder_id,
				snippet: sql<string>`SUBSTR(${schema.emails.body}, 1, 300)`,
			})
			.from(schema.emails)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(orderDir)
			.limit(limit)
			.offset(offset)
			.all();

		return result.map((email) => ({
			...email,
			read: !!email.read,
			starred: !!email.starred,
		}));
	}

	/**
	 * Count total emails matching the given filters (for pagination).
	 */
	async countEmails(options: { folder?: string; thread_id?: string } = {}) {
		const { folder, thread_id } = options;
		const conditions: string[] = [];
		const params: (string | number)[] = [];

		if (folder) {
			conditions.push(
				"folder_id = (SELECT id FROM folders WHERE name = ?1 OR id = ?1 LIMIT 1)",
			);
			params.push(folder);
		}

		if (thread_id) {
			conditions.push(`thread_id = ?${params.length + 1}`);
			params.push(thread_id);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const row = [
			...this.ctx.storage.sql.exec(
				`SELECT COUNT(*) as total FROM emails ${where}`,
				...params,
			),
		][0] as { total: number } | undefined;

		return row?.total ?? 0;
	}

	// ── Threaded queries (raw SQL — too complex for Drizzle's builder) ──

	async getThreadedEmails(options: GetEmailsOptions = {}) {
		const {
			folder,
			page = 1,
			limit: rawLimit = 25,
		} = options;
		const limit = Math.min(Math.max(rawLimit, 1), 100);

		if (!folder) {
			// Fallback to regular getEmails if no folder specified
			return this.getEmails(options);
		}

		const offset = (page - 1) * limit;

		// Thread grouping strategy:
		// For DRAFT folder: group by in_reply_to (the email being replied to).
		//   This ensures reply-drafts to different emails stay separate, even if
		//   they share a thread_id or subject. New drafts (no in_reply_to) each
		//   get their own group via their unique id.
		// For other folders:
		//   1. Primary: group by thread_id (from email threading headers)
		//   2. Fallback: group by normalized subject (strips Re:/Fwd:/FW: prefixes)
		//      for legacy emails that lack threading headers (thread_id IS NULL).
		const isDraftFolder = folder === Folders.DRAFT;

		if (isDraftFolder) {
			const result = this.ctx.storage.sql.exec(
				`WITH
				folder_emails AS (
					SELECT *,
						COALESCE(in_reply_to, id) as draft_group_key
					FROM emails
					WHERE folder_id = (SELECT id FROM folders WHERE name = ?1 OR id = ?1 LIMIT 1)
				),
				draft_stats AS (
					SELECT
						draft_group_key,
						COUNT(*) as thread_count,
						SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as thread_unread_count,
						GROUP_CONCAT(DISTINCT sender) as participants
					FROM folder_emails
					GROUP BY draft_group_key
				),
				latest_per_group AS (
					SELECT
						fe.*,
						ROW_NUMBER() OVER (
							PARTITION BY fe.draft_group_key
							ORDER BY fe.date DESC
						) as rn
					FROM folder_emails fe
				)
				SELECT
					lp.id, lp.subject, lp.sender, lp.recipient, lp.date,
					lp.read, lp.starred, lp.thread_id, lp.folder_id,
					lp.in_reply_to, lp.email_references,
					SUBSTR(lp.body, 1, 300) as snippet,
					ds.thread_count, ds.thread_unread_count, ds.participants,
					st.assignee_email, COALESCE(st.status, 'open') as status,
					COALESCE(st.priority, 'normal') as priority,
					COALESCE(st.needs_reply, 0) as state_needs_reply,
					st.last_seen_at
				FROM latest_per_group lp
				JOIN draft_stats ds ON lp.draft_group_key = ds.draft_group_key
				LEFT JOIN conversation_state st ON st.thread_id = lp.draft_group_key
				WHERE lp.rn = 1
				ORDER BY lp.date DESC
				LIMIT ?2 OFFSET ?3`,
				folder, limit, offset
			);

			const rows = [...result];
			return rows.map((row: any) => ({
				...row,
				...this.getContactSummaryForEmail(row.sender),
				read: !!row.read,
				starred: !!row.starred,
				thread_count: row.thread_count || 1,
				thread_unread_count: row.thread_unread_count || 0,
				participants: row.participants || row.sender,
				assignee_email: row.assignee_email ?? null,
				status: row.status || "open",
				priority: row.priority || "normal",
				state_needs_reply: !!row.state_needs_reply,
				last_seen_at: row.last_seen_at ?? null,
			}));
		}

		const isInboxView = folder === Folders.INBOX;
		const folderEmailsWhere = isInboxView
			? `folder_id IN ${INBOX_ACTIVE_FOLDERS_SQL}`
			: `folder_id = (SELECT id FROM folders WHERE name = ?1 OR id = ?1 LIMIT 1)`;
		const activeLatestFilter = isInboxView
			? `AND lmc.folder_id IN ${INBOX_ACTIVE_FOLDERS_SQL}`
			: "";

		const result = this.ctx.storage.sql.exec(
			`WITH
			folder_emails AS (
				SELECT *,
					COALESCE(thread_id, id) as raw_thread_id,
					${NORMALIZED_SUBJECT_SQL} as normalized_subject
				FROM emails
				WHERE ${folderEmailsWhere}
			),
			thread_to_conversation AS (
				SELECT
					raw_thread_id,
					normalized_subject,
					CASE
						WHEN thread_id IS NOT NULL THEN raw_thread_id
						ELSE MIN(raw_thread_id) OVER (PARTITION BY normalized_subject)
					END as conversation_id
				FROM folder_emails
				GROUP BY raw_thread_id, normalized_subject, thread_id
			),
			all_emails_with_conversation AS (
				SELECT
					e.*,
					COALESCE(tc.conversation_id, COALESCE(e.thread_id, e.id)) as conversation_id
				FROM emails e
				LEFT JOIN thread_to_conversation tc
					ON COALESCE(e.thread_id, e.id) = tc.raw_thread_id
			),
			conversation_stats AS (
				SELECT
					conversation_id,
					COUNT(*) as thread_count,
					SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as thread_unread_count,
					SUM(CASE WHEN read = 1 THEN 1 ELSE 0 END) as thread_read_count,
					GROUP_CONCAT(DISTINCT sender) as participants,
					SUM(CASE WHEN folder_id = (SELECT id FROM folders WHERE name = 'draft' LIMIT 1) THEN 1 ELSE 0 END) as has_draft
				FROM all_emails_with_conversation
				WHERE conversation_id IN (
					SELECT DISTINCT conversation_id FROM all_emails_with_conversation
					WHERE ${folderEmailsWhere}
				)
				GROUP BY conversation_id
			),
			latest_message_per_conversation AS (
				SELECT
					conversation_id,
					folder_id,
					ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY date DESC) as rn
				FROM all_emails_with_conversation
			),
			latest_in_folder AS (
				SELECT
					fe.*,
					COALESCE(tc.conversation_id, fe.raw_thread_id) as conversation_id,
					ROW_NUMBER() OVER (
						PARTITION BY COALESCE(tc.conversation_id, fe.raw_thread_id)
						ORDER BY fe.date DESC
					) as rn
				FROM folder_emails fe
				LEFT JOIN thread_to_conversation tc
					ON fe.raw_thread_id = tc.raw_thread_id
			)
			SELECT
				lif.id, lif.subject, lif.sender, lif.recipient, lif.date,
				lif.read, lif.starred, lif.thread_id, lif.folder_id,
				lif.in_reply_to, lif.email_references,
				SUBSTR(lif.body, 1, 300) as snippet,
				cs.thread_count, cs.thread_unread_count, cs.participants,
				CASE WHEN lmc.folder_id != (SELECT id FROM folders WHERE name = 'sent' LIMIT 1)
					AND lmc.folder_id != (SELECT id FROM folders WHERE name = 'draft' LIMIT 1)
					AND cs.thread_read_count > 0
					THEN 1 ELSE 0 END as needs_reply,
				CASE WHEN cs.has_draft > 0 THEN 1 ELSE 0 END as has_draft,
				st.assignee_email, COALESCE(st.status, 'open') as status,
				COALESCE(st.priority, 'normal') as priority,
				COALESCE(st.needs_reply, 0) as state_needs_reply,
				st.last_seen_at
			FROM latest_in_folder lif
			JOIN conversation_stats cs ON lif.conversation_id = cs.conversation_id
			LEFT JOIN latest_message_per_conversation lmc
				ON lmc.conversation_id = lif.conversation_id AND lmc.rn = 1
			LEFT JOIN conversation_state st ON st.thread_id = lif.conversation_id
			WHERE lif.rn = 1 ${activeLatestFilter}
			ORDER BY lif.date DESC
			LIMIT ${isInboxView ? "?1" : "?2"} OFFSET ${isInboxView ? "?2" : "?3"}`,
			...(isInboxView ? [limit, offset] : [folder, limit, offset]),
		);

		return [...result].map((row) => this.mapThreadedListRow(row));
	}

	private listRowContactField(row: {
		sender: string;
		recipient: string;
		folder_id: string;
	}) {
		const raw =
			row.folder_id === Folders.SENT ? row.recipient : row.sender;
		return raw?.split(",")[0]?.trim() || raw;
	}

	private mapThreadedListRow(row: Record<string, unknown>) {
		return {
			...row,
			...this.getContactSummaryForEmail(
				this.listRowContactField(row as {
					sender: string;
					recipient: string;
					folder_id: string;
				}),
			),
			read: !!row.read,
			starred: !!row.starred,
			thread_count: (row.thread_count as number) || 1,
			thread_unread_count: (row.thread_unread_count as number) || 0,
			participants: row.participants || row.sender,
			needs_reply: !!row.needs_reply,
			has_draft: !!row.has_draft,
			assignee_email: row.assignee_email ?? null,
			status: row.status || "open",
			priority: row.priority || "normal",
			state_needs_reply: !!row.state_needs_reply,
			last_seen_at: row.last_seen_at ?? null,
		};
	}

	private getContactSummaryForEmail(value?: string | null) {
		const email = value ? normalizeSocialEmailAddress(value) : null;
		if (!email) return {};

		const contact = [
			...this.ctx.storage.sql.exec(
				`SELECT email, display_name, bio, contact_description, relationship,
				        relationship_stage, tags, memory, location, website, last_seen_at
				 FROM contacts
				 WHERE email = ?1`,
				email,
			),
		][0] as any;

		if (!contact) {
			return { contact_email: email };
		}

		return {
			contact_email: contact.email,
			contact_display_name: contact.display_name ?? null,
			contact_bio: contact.bio ?? null,
			contact_description: contact.contact_description ?? null,
			contact_relationship: contact.relationship ?? null,
			contact_relationship_stage: contact.relationship_stage ?? null,
			contact_tags: contact.tags ?? null,
			contact_memory: contact.memory ?? null,
			contact_location: contact.location ?? null,
			contact_website: contact.website ?? null,
			contact_last_seen_at: contact.last_seen_at ?? null,
		};
	}

	/**
	 * Count threaded conversations in a folder (for pagination).
	 * Returns the number of conversation groups, not individual emails.
	 */
	async countThreadedEmails(folder: string) {
		const isDraftFolder = folder === Folders.DRAFT;

		if (isDraftFolder) {
			const row = [
				...this.ctx.storage.sql.exec(
					`SELECT COUNT(DISTINCT COALESCE(in_reply_to, id)) as total
					 FROM emails
					 WHERE folder_id = (SELECT id FROM folders WHERE name = ?1 OR id = ?1 LIMIT 1)`,
					folder,
				),
			][0] as { total: number } | undefined;
			return row?.total ?? 0;
		}

		const isInboxView = folder === Folders.INBOX;
		const folderEmailsWhere = isInboxView
			? `folder_id IN ${INBOX_ACTIVE_FOLDERS_SQL}`
			: `folder_id = (SELECT id FROM folders WHERE name = ?1 OR id = ?1 LIMIT 1)`;

		if (isInboxView) {
			const row = [
				...this.ctx.storage.sql.exec(
					`WITH
					folder_emails AS (
						SELECT
							COALESCE(thread_id, id) as raw_thread_id,
							thread_id,
							${NORMALIZED_SUBJECT_SQL} as normalized_subject
						FROM emails
						WHERE ${folderEmailsWhere}
					),
					thread_to_conversation AS (
						SELECT
							raw_thread_id,
							CASE
								WHEN thread_id IS NOT NULL THEN raw_thread_id
								WHEN normalized_subject != '' THEN MIN(raw_thread_id) OVER (PARTITION BY normalized_subject)
								ELSE raw_thread_id
							END as conversation_id
						FROM folder_emails
						GROUP BY raw_thread_id, normalized_subject, thread_id
					),
					all_emails_with_conversation AS (
						SELECT
							e.*,
							COALESCE(tc.conversation_id, COALESCE(e.thread_id, e.id)) as conversation_id
						FROM emails e
						LEFT JOIN thread_to_conversation tc
							ON COALESCE(e.thread_id, e.id) = tc.raw_thread_id
					),
					latest_message_per_conversation AS (
						SELECT
							conversation_id,
							folder_id,
							ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY date DESC) as rn
						FROM all_emails_with_conversation
						WHERE conversation_id IN (SELECT DISTINCT conversation_id FROM thread_to_conversation)
					)
					SELECT COUNT(*) as total
					FROM latest_message_per_conversation
					WHERE rn = 1
						AND folder_id IN ${INBOX_ACTIVE_FOLDERS_SQL}`,
				),
			][0] as { total: number } | undefined;
			return row?.total ?? 0;
		}

		const row = [
			...this.ctx.storage.sql.exec(
				`WITH
				folder_emails AS (
					SELECT
						COALESCE(thread_id, id) as raw_thread_id,
						thread_id,
					${NORMALIZED_SUBJECT_SQL} as normalized_subject
					FROM emails
					WHERE ${folderEmailsWhere}
				),
				thread_to_conversation AS (
					SELECT
						raw_thread_id,
						CASE
							WHEN thread_id IS NOT NULL THEN raw_thread_id
							WHEN normalized_subject != '' THEN MIN(raw_thread_id) OVER (PARTITION BY normalized_subject)
							ELSE raw_thread_id
						END as conversation_id
					FROM folder_emails
					GROUP BY raw_thread_id, normalized_subject, thread_id
				)
				SELECT COUNT(DISTINCT conversation_id) as total
				FROM thread_to_conversation`,
				folder,
			),
		][0] as { total: number } | undefined;
		return row?.total ?? 0;
	}

	// ── Single email operations (Drizzle) ──────────────────────────

	async getEmail(id: string) {
		const email = this.db
			.select()
			.from(schema.emails)
			.where(eq(schema.emails.id, id))
			.get();

		if (!email) return null;

		const emailAttachments = this.db
			.select()
			.from(schema.attachments)
			.where(eq(schema.attachments.email_id, id))
			.all();

		return {
			...email,
			read: !!email.read,
			starred: !!email.starred,
			attachments: emailAttachments,
		};
	}

	/**
	 * Fetch all emails in a thread with full bodies and attachments in
	 * two queries (one for emails, one for attachments) instead of
	 * N+1 individual getEmail calls.
	 */
	async getThreadEmails(threadId: string) {
		const emailRows = [
			...this.ctx.storage.sql.exec(
				`SELECT * FROM emails WHERE thread_id = ?1 ORDER BY date ASC`,
				threadId,
			),
		] as any[];

		if (emailRows.length === 0) return [];

		for (const email of emailRows) {
			this.upsertSocialGraphForEmail(email);
		}

		const emailIds = emailRows.map((e) => e.id as string);

		// Batch-fetch all attachments for the thread in a single query
		const placeholders = emailIds.map((_, i) => `?${i + 1}`).join(",");
		const attachmentRows = [
			...this.ctx.storage.sql.exec(
				`SELECT * FROM attachments WHERE email_id IN (${placeholders})`,
				...emailIds,
			),
		] as any[];

		// Group attachments by email_id
		const attachmentsByEmail = new Map<string, any[]>();
		for (const att of attachmentRows) {
			const list = attachmentsByEmail.get(att.email_id) || [];
			list.push(att);
			attachmentsByEmail.set(att.email_id, list);
		}

		return emailRows.map((email) => ({
			...email,
			read: !!email.read,
			starred: !!email.starred,
			attachments: attachmentsByEmail.get(email.id) || [],
		}));
	}

	async updateEmail(
		id: string,
		{ read, starred }: { read?: boolean; starred?: boolean },
	) {
		const data: { read?: number; starred?: number } = {};
		if (read !== undefined) {
			data.read = read ? 1 : 0;
		}
		if (starred !== undefined) {
			data.starred = starred ? 1 : 0;
		}

		if (Object.keys(data).length === 0) {
			return this.getEmail(id);
		}

		this.db
			.update(schema.emails)
			.set(data)
			.where(eq(schema.emails.id, id))
			.run();

		return this.getEmail(id);
	}

	async markThreadRead(threadId: string) {
		this.ctx.storage.sql.exec(
			`UPDATE emails SET read = 1 WHERE thread_id = ? AND read = 0`,
			threadId,
		);
		return { threadId, markedRead: true };
	}

	async deleteEmail(id: string) {
		const email = this.db
			.select({ id: schema.emails.id })
			.from(schema.emails)
			.where(eq(schema.emails.id, id))
			.get();

		if (!email) return null;

		const emailAttachments = this.db
			.select({
				id: schema.attachments.id,
				filename: schema.attachments.filename,
			})
			.from(schema.attachments)
			.where(eq(schema.attachments.email_id, id))
			.all();

		this.db
			.delete(schema.emails)
			.where(eq(schema.emails.id, id))
			.run();

		return emailAttachments;
	}

	async deleteThread(threadId: string) {
		const emailRows = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM emails WHERE thread_id = ?1 OR id = ?1`,
				threadId,
			),
		] as Array<{ id: string }>;

		if (emailRows.length === 0) return null;

		const deleted: Array<{
			emailId: string;
			attachments: Array<{ id: string; filename: string }>;
		}> = [];

		for (const row of emailRows) {
			const attachments = await this.deleteEmail(row.id);
			if (attachments === null) continue;
			deleted.push({ emailId: row.id, attachments });
		}

		this.ctx.storage.sql.exec(
			`DELETE FROM conversation_state WHERE thread_id = ?1`,
			threadId,
		);
		this.ctx.storage.sql.exec(
			`DELETE FROM internal_notes WHERE thread_id = ?1`,
			threadId,
		);
		this.ctx.storage.sql.exec(
			`DELETE FROM conversation_events WHERE thread_id = ?1`,
			threadId,
		);

		return { threadId, deleted };
	}

	async getAttachment(id: string) {
		return (
			this.db
				.select()
				.from(schema.attachments)
				.where(eq(schema.attachments.id, id))
				.get() ?? null
		);
	}

	// ── Folders (Drizzle) ──────────────────────────────────────────

	async getFolders() {
		const result = this.db
			.select({
				id: schema.folders.id,
				name: schema.folders.name,
				unreadCount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.emails.read} = 0 THEN 1 ELSE 0 END), 0)`.mapWith(Number),
			})
			.from(schema.folders)
			.leftJoin(schema.emails, eq(schema.emails.folder_id, schema.folders.id))
			.groupBy(schema.folders.id, schema.folders.name)
			.all();
		return result;
	}

	async createFolder(id: string, name: string, is_deletable: number = 1) {
		try {
			const result = this.db
				.insert(schema.folders)
				.values({ id, name, is_deletable })
				.returning({ id: schema.folders.id, name: schema.folders.name })
				.get();
			return { ...result, unreadCount: 0 };
		} catch (e: unknown) {
			if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
				return null;
			}
			throw e;
		}
	}

	async updateFolder(id: string, name: string) {
		const result = this.db
			.update(schema.folders)
			.set({ name })
			.where(eq(schema.folders.id, id))
			.returning({ id: schema.folders.id, name: schema.folders.name })
			.get();
		return result;
	}

	async deleteFolder(id: string) {
		const folder = this.db
			.select({ is_deletable: schema.folders.is_deletable })
			.from(schema.folders)
			.where(eq(schema.folders.id, id))
			.get();

		if (!folder || folder.is_deletable === 0) {
			return false;
		}

		this.db
			.delete(schema.folders)
			.where(eq(schema.folders.id, id))
			.run();

		return true;
	}

	async moveEmail(id: string, folderId: string) {
		const folder = this.db
			.select({ id: schema.folders.id })
			.from(schema.folders)
			.where(eq(schema.folders.id, folderId))
			.get();

		if (!folder) return false;

		this.db
			.update(schema.emails)
			.set({ folder_id: folderId })
			.where(eq(schema.emails.id, id))
			.run();

		return true;
	}

	async moveThread(threadId: string, folderId: string) {
		const folder = this.db
			.select({ id: schema.folders.id })
			.from(schema.folders)
			.where(eq(schema.folders.id, folderId))
			.get();

		if (!folder) return null;

		const emailRows = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM emails WHERE thread_id = ?1 OR id = ?1`,
				threadId,
			),
		] as Array<{ id: string }>;

		if (emailRows.length === 0) return null;

		for (const row of emailRows) {
			this.db
				.update(schema.emails)
				.set({ folder_id: folderId })
				.where(eq(schema.emails.id, row.id))
				.run();
		}

		return { threadId, movedCount: emailRows.length, folderId };
	}

	// ── Search (raw SQL — dynamic condition builder) ───────────────

	/**
	 * Build WHERE conditions and params for search queries.
	 * Shared between searchEmails and countSearchResults.
	 */
	#buildSearchConditions(
		options: SearchFilterOptions,
		tableAlias = "",
	): { conditions: string[]; params: (string | number)[] } {
		const { query, folder, from, to, subject, date_start, date_end, is_read, is_starred, has_attachment } = options;
		const prefix = tableAlias ? `${tableAlias}.` : "";
		const conditions: string[] = [];
		const params: (string | number)[] = [];
		let paramIdx = 0;

		const addParam = (value: string | number) => {
			paramIdx++;
			params.push(value);
			return `?${paramIdx}`;
		};

		if (query) {
			const p1 = addParam(`%${query}%`);
			const p2 = addParam(`%${query}%`);
			const p3 = addParam(`%${query}%`);
			const p4 = addParam(`%${query}%`);
			conditions.push(`(${prefix}subject LIKE ${p1} OR ${prefix}body LIKE ${p2} OR ${prefix}sender LIKE ${p3} OR ${prefix}recipient LIKE ${p4} OR ${prefix}cc LIKE ${p4} OR ${prefix}bcc LIKE ${p4})`);
		}
		if (folder) {
			const p = addParam(folder);
			conditions.push(`${prefix}folder_id = (SELECT id FROM folders WHERE name = ${p} OR id = ${p} LIMIT 1)`);
		}
		if (from) { const p = addParam(`%${from}%`); conditions.push(`${prefix}sender LIKE ${p}`); }
		if (to) { const p = addParam(`%${to}%`); conditions.push(`(${prefix}recipient LIKE ${p} OR ${prefix}cc LIKE ${p} OR ${prefix}bcc LIKE ${p})`); }
		if (subject) { const p = addParam(`%${subject}%`); conditions.push(`${prefix}subject LIKE ${p}`); }
		if (date_start) { const p = addParam(date_start); conditions.push(`${prefix}date >= ${p}`); }
		if (date_end) { const p = addParam(date_end); conditions.push(`${prefix}date <= ${p}`); }
		if (is_read !== undefined) { const p = addParam(is_read ? 1 : 0); conditions.push(`${prefix}read = ${p}`); }
		if (is_starred !== undefined) { const p = addParam(is_starred ? 1 : 0); conditions.push(`${prefix}starred = ${p}`); }
		if (has_attachment) { conditions.push(`${prefix}id IN (SELECT DISTINCT email_id FROM attachments)`); }

		return { conditions, params };
	}

	async searchEmails(options: SearchFilterOptions & { page?: number; limit?: number }) {
		const { page = 1, limit: rawLimit = 25 } = options;
		const limit = Math.min(Math.max(rawLimit, 1), 100);
		const { conditions, params } = this.#buildSearchConditions(options, "e");

		const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const offset = (page - 1) * limit;

		const query = `
			SELECT e.id, e.subject, e.sender, e.recipient, e.cc, e.bcc, e.date,
				e.read, e.starred, e.in_reply_to, e.email_references,
				e.thread_id, e.folder_id,
				SUBSTR(e.body, 1, 300) as snippet,
				f.name as folder_name
			FROM emails e
			LEFT JOIN folders f ON e.folder_id = f.id
			${where}
			ORDER BY e.date DESC LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`;
		params.push(limit, offset);

		const result = this.ctx.storage.sql.exec(query, ...params);
		return [...result].map((row: any) => ({
			...row,
			read: !!row.read,
			starred: !!row.starred,
		}));
	}

	/**
	 * Count total search results matching the given filters (for pagination).
	 */
	async countSearchResults(options: SearchFilterOptions) {
		const { conditions, params } = this.#buildSearchConditions(options);

		const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const query = `SELECT COUNT(*) as total FROM emails ${where}`;

		const row = [...this.ctx.storage.sql.exec(query, ...params)][0] as
			| { total: number }
			| undefined;
		return row?.total ?? 0;
	}

	// ── Threading helpers (raw SQL) ────────────────────────────────

	async findThreadBySubject(subject: string, senderAddress?: string): Promise<string | null> {
		const normalized = subject
			.replace(/^(?:(?:re|fwd?|fw|aw|wg|r[eé]f|sv)\s*:\s*)+/i, "")
			.trim()
			.toLowerCase();

		if (!normalized) return null;

		const result = this.ctx.storage.sql.exec(
			`SELECT thread_id, subject,
			        GROUP_CONCAT(DISTINCT LOWER(sender)) as senders,
			        GROUP_CONCAT(DISTINCT LOWER(recipient)) as recipients
			 FROM emails
			 WHERE thread_id IS NOT NULL
			   AND thread_id != id
			   AND date >= datetime('now', '-7 days')
			 GROUP BY thread_id
			 ORDER BY MAX(date) DESC
			 LIMIT 50`,
		);

		const normalizedSender = senderAddress?.toLowerCase().trim();

		for (const row of result) {
			const rowSubject = String((row as any).subject || "")
				.replace(/^(?:(?:re|fwd?|fw|aw|wg|r[eé]f|sv)\s*:\s*)+/i, "")
				.trim()
				.toLowerCase();
			if (rowSubject !== normalized) continue;

			if (normalizedSender) {
				const threadSenders = String((row as any).senders || "");
				const threadRecipients = String((row as any).recipients || "");
				const allParticipants = `${threadSenders},${threadRecipients}`;
				if (!allParticipants.includes(normalizedSender)) {
					continue;
				}
			}

			return String((row as any).thread_id);
		}
		return null;
	}

	// ── Rate limiting (raw SQL) ────────────────────────────────────

	/**
	 * Check if the mailbox has exceeded the send rate limit.
	 * Limits: 20 emails per hour, 100 per day per mailbox.
	 * Returns null if under limit, or an error message string if exceeded.
	 */
	async checkSendRateLimit(): Promise<string | null> {
		const hourRow = [...this.ctx.storage.sql.exec(
			`SELECT COUNT(*) as cnt FROM emails
			 WHERE folder_id = ?1
			   AND date >= datetime('now', '-1 hour')`,
			Folders.SENT,
		)][0] as { cnt: number } | undefined;

		if ((hourRow?.cnt ?? 0) >= 20) {
			return "Rate limit exceeded: max 20 emails per hour per mailbox";
		}

		const dayRow = [...this.ctx.storage.sql.exec(
			`SELECT COUNT(*) as cnt FROM emails
			 WHERE folder_id = ?1
			   AND date >= datetime('now', '-1 day')`,
			Folders.SENT,
		)][0] as { cnt: number } | undefined;

		if ((dayRow?.cnt ?? 0) >= 100) {
			return "Rate limit exceeded: max 100 emails per day per mailbox";
		}

		return null;
	}

	// ── Email creation (Drizzle) ───────────────────────────────────

	isSenderBlocked(senderEmail: string) {
		const sender = senderEmail.trim().toLowerCase();
		if (!sender) return false;
		const row = [
			...this.ctx.storage.sql.exec(
				`SELECT blocked FROM contacts WHERE email = ?1`,
				sender,
			),
		][0] as { blocked: number } | undefined;
		return (row?.blocked ?? 0) === 1;
	}

	async createEmail(
		folder: string,
		email: EmailData,
		attachments: AttachmentData[],
	) {
		// Resolve folder name or ID to the actual folder ID.
		const folderRow = this.db
			.select({ id: schema.folders.id })
			.from(schema.folders)
			.where(or(eq(schema.folders.id, folder), eq(schema.folders.name, folder)))
			.limit(1)
			.get();

		if (!folderRow) {
			throw new Error(
				`createEmail: folder "${folder}" not found. ` +
					"Ensure the folder exists before inserting an email.",
			);
		}

		const folderId = folderRow.id;
		const isSent = folderId === Folders.SENT;

		if (folderId === Folders.INBOX && email.sender && this.isSenderBlocked(email.sender)) {
			return;
		}

		// Sent emails are always read — the sender obviously knows what they wrote.
		// This prevents sent replies from inflating thread_unread_count.
		this.db
			.insert(schema.emails)
			.values({
				id: email.id,
				folder_id: folderId,
				subject: email.subject,
				sender: email.sender,
				recipient: email.recipient,
				cc: email.cc ?? null,
				bcc: email.bcc ?? null,
				date: email.date,
				read: isSent ? 1 : (email.read ? 1 : 0),
				starred: email.starred ? 1 : 0,
				body: email.body,
				in_reply_to: email.in_reply_to ?? null,
				email_references: email.email_references ?? null,
				thread_id: email.thread_id ?? null,
				message_id: email.message_id ?? null,
				raw_headers: email.raw_headers ?? null,
			})
			.run();

		if (attachments.length > 0) {
			this.db.insert(schema.attachments).values(attachments).run();
		}

		this.upsertSocialGraphForEmail({ ...email, thread_id: email.thread_id ?? email.id });
	}

	getConversationParticipants(threadId: string) {
		return [
			...this.ctx.storage.sql.exec(
				`SELECT c.id, c.email, c.display_name, c.bio, c.contact_description, c.relationship,
				        c.relationship_stage, c.tags, c.memory, c.location, c.website,
				        c.first_seen_at, c.last_seen_at, c.updated_at
				 FROM conversation_participants cp
				 JOIN contacts c ON c.id = cp.contact_id
				 WHERE cp.thread_id = ?1
				 ORDER BY c.email ASC`,
				threadId,
			),
		];
	}

	getContactProfile(emailAddress: string) {
		const email = emailAddress.trim().toLowerCase();
		const contact = [
			...this.ctx.storage.sql.exec(
				`SELECT id, email, display_name, bio, contact_description, relationship,
				        relationship_stage, tags, memory, location, website,
				        first_seen_at, last_seen_at, updated_at, blocked
				 FROM contacts
				 WHERE email = ?1`,
				email,
			),
		][0] as any;

		if (!contact) return null;

		const threads = [
			...this.ctx.storage.sql.exec(
				`SELECT cp.thread_id
				 FROM conversation_participants cp
				 WHERE cp.contact_id = ?1
				 ORDER BY cp.thread_id ASC
				 LIMIT 25`,
				contact.id,
			),
		];

		return {
			...contact,
			blocked: (contact.blocked ?? 0) === 1,
			threads,
		};
	}

	updateContactProfile(
		emailAddress: string,
		patch: {
			display_name?: string | null;
			bio?: string | null;
			contact_description?: string | null;
			relationship?: string | null;
			relationship_stage?: string | null;
			tags?: string | null;
			memory?: string | null;
			location?: string | null;
			website?: string | null;
			blocked?: boolean;
		},
	) {
		const email = emailAddress.trim().toLowerCase();
		const now = new Date().toISOString();
		const contactId = socialContactIdForEmail(email);
		const current = this.getContactProfile(email) as any;
		type StringProfileField = Exclude<keyof typeof patch, "blocked">;
		const valueFor = (key: StringProfileField) =>
			Object.prototype.hasOwnProperty.call(patch, key)
				? patch[key]?.trim() || null
				: current?.[key] ?? null;
		const clean = {
			display_name: valueFor("display_name"),
			bio: valueFor("bio"),
			contact_description: valueFor("contact_description"),
			relationship: valueFor("relationship"),
			relationship_stage: valueFor("relationship_stage"),
			tags: valueFor("tags"),
			memory: valueFor("memory"),
			location: valueFor("location"),
			website: valueFor("website"),
		};
		const blocked = Object.prototype.hasOwnProperty.call(patch, "blocked")
			? patch.blocked
				? 1
				: 0
			: (current?.blocked ? 1 : 0);

		this.ctx.storage.sql.exec(
			`INSERT INTO contacts (
				id, email, display_name, bio, contact_description, relationship,
				relationship_stage, tags, memory, location, website, blocked,
				first_seen_at, last_seen_at, updated_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13, ?13)
			ON CONFLICT(email) DO UPDATE SET
				display_name = excluded.display_name,
				bio = excluded.bio,
				contact_description = excluded.contact_description,
				relationship = excluded.relationship,
				relationship_stage = excluded.relationship_stage,
				tags = excluded.tags,
				memory = excluded.memory,
				location = excluded.location,
				website = excluded.website,
				blocked = excluded.blocked,
				updated_at = excluded.updated_at`,
			contactId,
			email,
			clean.display_name,
			clean.bio,
			clean.contact_description,
			clean.relationship,
			clean.relationship_stage,
			clean.tags,
			clean.memory,
			clean.location,
			clean.website,
			blocked,
			now,
		);

		return this.getContactProfile(email);
	}

	getConversationState(threadId: string) {
		const row = [
			...this.ctx.storage.sql.exec(
				`SELECT thread_id, assignee_email, status, priority, needs_reply, last_seen_at, updated_at
				 FROM conversation_state
				 WHERE thread_id = ?1`,
				threadId,
			),
		][0] as any;

		return {
			thread_id: threadId,
			assignee_email: row?.assignee_email ?? null,
			status: row?.status ?? "open",
			priority: row?.priority ?? "normal",
			needs_reply: !!row?.needs_reply,
			last_seen_at: row?.last_seen_at ?? null,
			updated_at: row?.updated_at ?? null,
		};
	}

	updateConversationState(threadId: string, patch: ConversationStatePatch) {
		const current = this.getConversationState(threadId);
		const next = {
			...current,
			...patch,
			updated_at: new Date().toISOString(),
		};

		this.ctx.storage.sql.exec(
			`INSERT INTO conversation_state (
				thread_id, assignee_email, status, priority, needs_reply, last_seen_at, updated_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			ON CONFLICT(thread_id) DO UPDATE SET
				assignee_email = excluded.assignee_email,
				status = excluded.status,
				priority = excluded.priority,
				needs_reply = excluded.needs_reply,
				last_seen_at = excluded.last_seen_at,
				updated_at = excluded.updated_at`,
			threadId,
			next.assignee_email,
			next.status,
			next.priority,
			next.needs_reply ? 1 : 0,
			next.last_seen_at,
			next.updated_at,
		);

		this.createConversationEvent(threadId, "state_updated", next.assignee_email, patch);

		return this.getConversationState(threadId);
	}

	listInternalNotes(threadId: string) {
		return [
			...this.ctx.storage.sql.exec(
				`SELECT id, thread_id, author_email, body, created_at, updated_at
				 FROM internal_notes
				 WHERE thread_id = ?1
				 ORDER BY created_at ASC`,
				threadId,
			),
		];
	}

	createInternalNote(threadId: string, authorEmail: string, body: string) {
		const now = new Date().toISOString();
		const note = {
			id: crypto.randomUUID(),
			thread_id: threadId,
			author_email: authorEmail.toLowerCase(),
			body,
			created_at: now,
			updated_at: now,
		};

		this.ctx.storage.sql.exec(
			`INSERT INTO internal_notes (id, thread_id, author_email, body, created_at, updated_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
			note.id,
			note.thread_id,
			note.author_email,
			note.body,
			note.created_at,
		);
		this.createConversationEvent(threadId, "note_created", note.author_email, { noteId: note.id });
		return note;
	}

	listConversationEvents(threadId: string) {
		return [
			...this.ctx.storage.sql.exec(
				`SELECT id, thread_id, type, actor_email, payload, created_at
				 FROM conversation_events
				 WHERE thread_id = ?1
				 ORDER BY created_at ASC`,
				threadId,
			),
		].map((event: any) => ({
			...event,
			payload: event.payload ? JSON.parse(event.payload) : null,
		}));
	}

	insertAuditEntry(entry: AuditEntryInput) {
		const row = {
			id: crypto.randomUUID(),
			actor_email: entry.actor_email.toLowerCase(),
			action: entry.action,
			target_type: entry.target_type,
			target_id: entry.target_id,
			payload: entry.payload ? JSON.stringify(entry.payload) : null,
			created_at: new Date().toISOString(),
		};

		this.ctx.storage.sql.exec(
			`INSERT INTO audit_log (id, actor_email, action, target_type, target_id, payload, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
			row.id,
			row.actor_email,
			row.action,
			row.target_type,
			row.target_id,
			row.payload,
			row.created_at,
		);

		return row;
	}

	getRetentionStats(options: RetentionPolicyOptions = {}) {
		const { trashCutoff, sentCutoff, trashDays, sentDays } = getRetentionCutoffs(Date.now(), options);
		const testMode =
			trashDays !== TRASH_RETENTION_DAYS || sentDays !== SENT_ARCHIVE_DAYS;
		const trashTotal = Number(
			[...this.ctx.storage.sql.exec(
				`SELECT COUNT(*) AS total FROM emails WHERE folder_id = ?1`,
				Folders.TRASH,
			)][0]?.total ?? 0,
		);
		const sentTotal = Number(
			[...this.ctx.storage.sql.exec(
				`SELECT COUNT(*) AS total FROM emails WHERE folder_id = ?1`,
				Folders.SENT,
			)][0]?.total ?? 0,
		);
		const trashEligible = Number(
			[...this.ctx.storage.sql.exec(
				`SELECT COUNT(*) AS total FROM emails WHERE folder_id = ?1 AND date < ?2`,
				Folders.TRASH,
				trashCutoff,
			)][0]?.total ?? 0,
		);
		const sentEligible = Number(
			[...this.ctx.storage.sql.exec(
				`SELECT COUNT(*) AS total FROM emails WHERE folder_id = ?1 AND date < ?2`,
				Folders.SENT,
				sentCutoff,
			)][0]?.total ?? 0,
		);

		return {
			trashTotal,
			sentTotal,
			trashEligible,
			sentEligible,
			trashCutoff,
			sentCutoff,
			trashDays,
			sentDays,
			testMode,
		};
	}

	async runRetention(
		actorEmail = "system",
		options: RetentionPolicyOptions = {},
	): Promise<RetentionRunResult> {
		const stats = this.getRetentionStats(options);
		const { trashCutoff, sentCutoff } = stats;
		const purgedEmailIds: string[] = [];
		const archivedEmailIds: string[] = [];

		const trashEmails = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM emails
				 WHERE folder_id = ?1 AND date < ?2
				 ORDER BY date ASC
				 LIMIT ?3`,
				Folders.TRASH,
				trashCutoff,
				RETENTION_BATCH_SIZE,
			),
		] as Array<{ id: string }>;

		for (const email of trashEmails) {
			const attachments = await this.deleteEmail(email.id);
			if (attachments === null) continue;
			purgedEmailIds.push(email.id);
			if (attachments.length > 0) {
				await this.env.BUCKET.delete(
					attachments.map(
						(att) => `attachments/${email.id}/${att.id}/${att.filename}`,
					),
				);
			}
		}

		const sentEmails = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM emails
				 WHERE folder_id = ?1 AND date < ?2
				 ORDER BY date ASC
				 LIMIT ?3`,
				Folders.SENT,
				sentCutoff,
				RETENTION_BATCH_SIZE,
			),
		] as Array<{ id: string }>;

		for (const email of sentEmails) {
			const moved = await this.moveEmail(email.id, Folders.ARCHIVE);
			if (moved) archivedEmailIds.push(email.id);
		}

		if (purgedEmailIds.length > 0) {
			this.insertAuditEntry({
				actor_email: actorEmail,
				action: "retention.purge",
				target_type: "mailbox",
				target_id: "retention",
				payload: { count: purgedEmailIds.length, emailIds: purgedEmailIds },
			});
		}

		if (archivedEmailIds.length > 0) {
			this.insertAuditEntry({
				actor_email: actorEmail,
				action: "retention.archive",
				target_type: "mailbox",
				target_id: "retention",
				payload: { count: archivedEmailIds.length, emailIds: archivedEmailIds },
			});
		}

		return {
			purgedCount: purgedEmailIds.length,
			archivedCount: archivedEmailIds.length,
			purgedEmailIds,
			archivedEmailIds,
			stats,
		};
	}

	listAuditEntries(options: AuditListOptions = {}) {
		const normalized = normalizeAuditListOptions(options);
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (normalized.action) {
			conditions.push(`action = ?${params.length + 1}`);
			params.push(normalized.action);
		}
		if (normalized.actor) {
			conditions.push(`actor_email = ?${params.length + 1}`);
			params.push(normalized.actor);
		}
		if (normalized.from) {
			conditions.push(`created_at >= ?${params.length + 1}`);
			params.push(normalized.from);
		}
		if (normalized.to) {
			conditions.push(`created_at <= ?${params.length + 1}`);
			params.push(normalized.to);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const countSql = `SELECT COUNT(*) AS total FROM audit_log ${whereClause}`;
		const totalCount = Number(
			[...this.ctx.storage.sql.exec(countSql, ...params)][0]?.total ?? 0,
		);

		const listSql = `
			SELECT id, actor_email, action, target_type, target_id, payload, created_at
			FROM audit_log
			${whereClause}
			ORDER BY created_at DESC
			LIMIT ?${params.length + 1}
			OFFSET ?${params.length + 2}
		`;
		const entries = [
			...this.ctx.storage.sql.exec(
				listSql,
				...params,
				normalized.limit,
				normalized.offset,
			),
		].map((entry: any) => ({
			...entry,
			payload: entry.payload ? JSON.parse(entry.payload) : null,
		}));

		return {
			entries,
			totalCount,
			page: normalized.page,
			limit: normalized.limit,
		};
	}

	private createConversationEvent(
		threadId: string,
		type: ConversationEventType,
		actorEmail: string | null,
		payload: unknown,
	) {
		this.ctx.storage.sql.exec(
			`INSERT INTO conversation_events (id, thread_id, type, actor_email, payload, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			crypto.randomUUID(),
			threadId,
			type,
			actorEmail,
			JSON.stringify(payload ?? null),
			new Date().toISOString(),
		);
	}

	collectMailboxAttachmentKeys() {
		const rows = this.db
			.select({
				emailId: schema.emails.id,
				attachmentId: schema.attachments.id,
				filename: schema.attachments.filename,
			})
			.from(schema.attachments)
			.innerJoin(schema.emails, eq(schema.attachments.email_id, schema.emails.id))
			.all();

		return rows.map(
			(row) => `attachments/${row.emailId}/${row.attachmentId}/${row.filename}`,
		);
	}

	getExplicitMailboxRole(userEmail: string): MailboxRole | null {
		const normalized = userEmail.trim().toLowerCase();
		if (!normalized) return null;
		const row = this.db
			.select({ role: schema.mailboxPermissions.role })
			.from(schema.mailboxPermissions)
			.where(eq(schema.mailboxPermissions.user_email, normalized))
			.get();
		if (!row) return null;
		return MAILBOX_ROLES.includes(row.role as MailboxRole)
			? (row.role as MailboxRole)
			: null;
	}

	listMailboxPermissions() {
		return this.db
			.select()
			.from(schema.mailboxPermissions)
			.orderBy(asc(schema.mailboxPermissions.granted_at))
			.all();
	}

	grantMailboxPermission(
		userEmail: string,
		role: MailboxRole,
		grantedBy: string,
	) {
		const normalized = userEmail.trim().toLowerCase();
		if (!normalized) throw new Error("User email is required");
		if (!MAILBOX_ROLES.includes(role) || role === "owner" || role === "admin") {
			throw new Error("Invalid role for mailbox grant");
		}

		const now = new Date().toISOString();
		this.db
			.insert(schema.mailboxPermissions)
			.values({
				user_email: normalized,
				role,
				granted_by: grantedBy.trim().toLowerCase(),
				granted_at: now,
			})
			.onConflictDoUpdate({
				target: schema.mailboxPermissions.user_email,
				set: { role, granted_by: grantedBy.trim().toLowerCase(), granted_at: now },
			})
			.run();

		this.insertAuditEntry({
			actor_email: grantedBy,
			action: "permission.grant",
			target_type: "user",
			target_id: normalized,
			payload: { role },
		});

		return this.db
			.select()
			.from(schema.mailboxPermissions)
			.where(eq(schema.mailboxPermissions.user_email, normalized))
			.get();
	}

	revokeMailboxPermission(userEmail: string, revokedBy: string) {
		const normalized = userEmail.trim().toLowerCase();
		if (!normalized) throw new Error("User email is required");
		const existing = this.db
			.select()
			.from(schema.mailboxPermissions)
			.where(eq(schema.mailboxPermissions.user_email, normalized))
			.get();
		if (!existing) return false;

		this.db
			.delete(schema.mailboxPermissions)
			.where(eq(schema.mailboxPermissions.user_email, normalized))
			.run();

		this.insertAuditEntry({
			actor_email: revokedBy,
			action: "permission.revoke",
			target_type: "user",
			target_id: normalized,
			payload: { role: existing.role },
		});
		return true;
	}

	private upsertSocialGraphForEmail(email: {
		id?: string;
		sender?: string | null;
		recipient?: string | null;
		cc?: string | null;
		bcc?: string | null;
		thread_id?: string | null;
	}) {
		const threadId = email.thread_id ?? email.id;
		if (!threadId) return;

		const now = new Date().toISOString();
		for (const participantEmail of extractSocialParticipants(email)) {
			const contactId = socialContactIdForEmail(participantEmail);
			this.ctx.storage.sql.exec(
				`INSERT INTO contacts (id, email, first_seen_at, last_seen_at)
				 VALUES (?1, ?2, ?3, ?3)
				 ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
				contactId,
				participantEmail,
				now,
			);
			this.ctx.storage.sql.exec(
				`INSERT INTO conversation_participants (thread_id, contact_id, first_seen_at, last_seen_at)
				 VALUES (?1, ?2, ?3, ?3)
				 ON CONFLICT(thread_id, contact_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
				threadId,
				contactId,
				now,
			);
		}
	}
}
