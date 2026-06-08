// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import PostalMime from "postal-mime";
import { z } from "zod";
import {
	assertAttachmentBelongsToEmail,
	isAllowedInboundImageAttachment,
	storeAttachments,
	type StoredAttachment,
} from "./lib/attachments";
import {
	validateSender,
	SenderValidationError,
	generateMessageId,
	listMailboxes,
} from "./lib/email-helpers";
import { deliverInternalEmail } from "./lib/internal-delivery";
import { getInternalOnlyDeliveryError, getRecipientRouting } from "./lib/recipient-routing";
import { SendEmailRequestSchema } from "./lib/schemas";
import { handleReplyEmail, handleForwardEmail } from "./routes/reply-forward";
import { Folders } from "../shared/folders";
import type { Env } from "./types";
import {
	assertContextPermission,
	getLegacyAccessOptions,
	requireMailbox,
	type MailboxContext,
} from "./lib/mailbox";
import {
	assertMailboxAccess,
	AccessAuthorizationError,
	filterMailboxIdsForAccess,
} from "./lib/access";
import {
	assertAdminAccess,
	getDomainConfig,
	updateDomainConfig,
} from "./lib/admin";
import {
	PermissionError,
	resolveMailboxRole,
} from "./lib/permissions";
import { normalizeConversationStatePatch } from "./lib/conversation-state";
import { normalizeInternalNoteBody } from "./lib/internal-notes";
import {
	assertAuditAdminAccess,
	normalizeAuditListOptions,
	recordAudit,
} from "./lib/audit";
import { normalizeRetentionPolicyOptions } from "./lib/retention";
import {
	assertOutboundRecipientsAllowed,
	BoardAccessError,
	isNewTopicSend,
	listAccessibleBoards,
	loadMailboxSettings,
} from "./lib/boards";
import {
	decodeAvatarUpload,
	decodeCoverUpload,
	profileAvatarKey,
	profileCoverKey,
} from "./lib/profile-avatar";
import { normalizeEmail } from "./lib/access";

type AppContext = Context<MailboxContext>;
const ALLOW_FORWARDING = true;

const DomainConfigBody = z.object({
	domains: z.array(z.string()).optional(),
	emailAddresses: z.array(z.string().email()).optional(),
	accessEmailAddresses: z.array(z.string().email()).optional(),
});

const PermissionGrantBody = z.object({
	userEmail: z.string().email(),
	role: z.enum(["manager", "member", "viewer"]),
});

// -- Request body schemas (kept for validation) ---------------------

const CreateMailboxBody = z.object({
	email: z.string().email(),
	name: z.string().min(1),
	settings: z.record(z.any()).optional(), // unvalidated — agentSystemPrompt goes straight to AI
});

const SignupRequestBody = z.object({
	displayName: z.string().trim().min(1).max(120),
	personalEmail: z.string().trim().email().max(160),
	desiredMailbox: z.string().trim().email().max(160),
	note: z.string().trim().max(500).optional().default(""),
});

const DraftBody = z.object({
	to: z.string().optional(),
	cc: z.string().optional(),
	bcc: z.string().optional(),
	subject: z.string().optional(),
	body: z.string(),
	in_reply_to: z.string().optional(),
	thread_id: z.string().optional(),
	draft_id: z.string().optional(),
});

const AvatarUploadBody = z.object({
	content: z.string().min(1),
	type: z.string().min(1),
});

const ContactProfilePatchBody = z.object({
	display_name: z.string().trim().max(120).nullable().optional(),
	bio: z.string().trim().max(280).nullable().optional(),
	contact_description: z.string().trim().max(1000).nullable().optional(),
	relationship: z.string().trim().max(120).nullable().optional(),
	relationship_stage: z.string().trim().max(80).nullable().optional(),
	tags: z.string().trim().max(240).nullable().optional(),
	memory: z.string().trim().max(1200).nullable().optional(),
	location: z.string().trim().max(160).nullable().optional(),
	website: z.string().trim().max(240).nullable().optional(),
});

// -- Helpers --------------------------------------------------------

function slugify(text: string) { // can return "" for non-alphanumeric input
	return text.toString().toLowerCase()
		.replace(/\s+/g, "-").replace(/[^\w-]+/g, "")
		.replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}

function intQuery(c: AppContext, key: string): number | undefined {
	const v = c.req.query(key);
	if (!v) return undefined;
	const n = Number(v);
	return Number.isNaN(n) ? undefined : n;
}

function boolQuery(c: AppContext, key: string): boolean | undefined {
	const v = c.req.query(key);
	if (v === undefined || v === "") return undefined;
	return v === "true" || v === "1";
}

async function getMailboxAccessOptions(c: AppContext) {
	return getLegacyAccessOptions(c.env);
}

function handlePermissionError(c: AppContext, error: unknown) {
	if (error instanceof PermissionError) {
		return c.json({ error: error.message }, 403);
	}
	throw error;
}

function requirePermission(c: AppContext, permission: Parameters<typeof assertContextPermission>[1]) {
	assertContextPermission(c.var.mailboxRole, permission);
}

function getAuditActor(c: AppContext, mailboxId: string) {
	return c.var.accessEmail || mailboxId;
}

// -- App & middleware -----------------------------------------------

const app = new Hono<MailboxContext>();
app.use("/api/*", cors({
	origin: (origin) => {
		// Same-origin requests have no Origin header — allow them.
		if (!origin) return origin;
		// In development, allow localhost for Vite dev server.
		try {
			const url = new URL(origin);
			if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return origin;
		} catch { /* invalid origin */ }
		// Block all other cross-origin requests. The app is served from the
		// same origin as the API, so legitimate browser requests never send
		// an Origin header. Returning undefined omits Access-Control-Allow-Origin.
		return undefined;
	},
}));

async function assertOrgMemberProfileAccess(
	env: Env,
	accessEmail: string,
	mailboxId: string,
) {
	const normalizedMailboxId = normalizeEmail(mailboxId);
	const mailboxKey = `mailboxes/${normalizedMailboxId}.json`;
	if (!(await env.BUCKET.head(mailboxKey))) {
		return { ok: false as const, status: 404 as const, error: "Not found" };
	}

	const accessOptions = await getLegacyAccessOptions(env);
	if (!accessEmail && !accessOptions.allowMissingIdentity) {
		return { ok: false as const, status: 403 as const, error: "Forbidden" };
	}

	if (accessEmail) {
		const config = await getDomainConfig(env);
		const visible = filterMailboxIdsForAccess(
			config.emailAddresses,
			accessEmail,
			accessOptions,
		);
		if (visible.length === 0) {
			return { ok: false as const, status: 403 as const, error: "Forbidden" };
		}
	}

	return { ok: true as const, mailboxId: normalizedMailboxId };
}

app.get("/api/v1/mailboxes/:mailboxId/avatar", async (c) => {
	const mailboxId = c.req.param("mailboxId")!;
	const access = await assertOrgMemberProfileAccess(
		c.env,
		c.var.accessEmail,
		mailboxId,
	);
	if (!access.ok) return c.json({ error: access.error }, access.status);

	const obj = await c.env.BUCKET.get(profileAvatarKey(access.mailboxId));
	if (!obj) return c.body(null, 404);

	const headers = new Headers();
	headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
	headers.set("Cache-Control", "public, max-age=300");
	if (obj.etag) headers.set("ETag", obj.etag);
	return new Response(obj.body, { headers });
});

app.get("/api/v1/mailboxes/:mailboxId/cover", async (c) => {
	const mailboxId = c.req.param("mailboxId")!;
	const access = await assertOrgMemberProfileAccess(
		c.env,
		c.var.accessEmail,
		mailboxId,
	);
	if (!access.ok) return c.json({ error: access.error }, access.status);

	const obj = await c.env.BUCKET.get(profileCoverKey(access.mailboxId));
	if (!obj) return c.body(null, 404);

	const headers = new Headers();
	headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
	headers.set("Cache-Control", "public, max-age=300");
	if (obj.etag) headers.set("ETag", obj.etag);
	return new Response(obj.body, { headers });
});

app.put("/api/v1/mailboxes/:mailboxId/avatar", requireMailbox, async (c: AppContext) => {
	const mailboxId = c.req.param("mailboxId")!;
	try {
		requirePermission(c, "settings");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	let body: z.infer<typeof AvatarUploadBody>;
	try {
		body = AvatarUploadBody.parse(await c.req.json());
	} catch {
		return c.json({ error: "Invalid avatar payload" }, 400);
	}

	let decoded: ReturnType<typeof decodeAvatarUpload>;
	try {
		decoded = decodeAvatarUpload(body);
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : "Invalid avatar" },
			400,
		);
	}

	const avatarKey = profileAvatarKey(mailboxId);
	await c.env.BUCKET.put(avatarKey, decoded.bytes, {
		httpMetadata: { contentType: decoded.contentType },
	});

	const settingsKey = `mailboxes/${mailboxId}.json`;
	const settingsObj = await c.env.BUCKET.get(settingsKey);
	const settings = settingsObj
		? ((await settingsObj.json()) as Record<string, unknown>)
		: {};
	const avatarUpdatedAt = new Date().toISOString();
	const nextSettings = { ...settings, avatarUpdatedAt };
	await c.env.BUCKET.put(settingsKey, JSON.stringify(nextSettings));

	void recordAudit(c.var.mailboxStub, {
		actor_email: getAuditActor(c, mailboxId),
		action: "mailbox.avatar_update",
		target_type: "mailbox",
		target_id: mailboxId,
	});

	return c.json({ avatarUpdatedAt });
});

app.put("/api/v1/mailboxes/:mailboxId/cover", requireMailbox, async (c: AppContext) => {
	const mailboxId = c.req.param("mailboxId")!;
	try {
		requirePermission(c, "settings");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	let body: z.infer<typeof AvatarUploadBody>;
	try {
		body = AvatarUploadBody.parse(await c.req.json());
	} catch {
		return c.json({ error: "Invalid cover payload" }, 400);
	}

	let decoded: ReturnType<typeof decodeCoverUpload>;
	try {
		decoded = decodeCoverUpload(body);
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : "Invalid cover" },
			400,
		);
	}

	const coverKey = profileCoverKey(mailboxId);
	await c.env.BUCKET.put(coverKey, decoded.bytes, {
		httpMetadata: { contentType: decoded.contentType },
	});

	const settingsKey = `mailboxes/${mailboxId}.json`;
	const settingsObj = await c.env.BUCKET.get(settingsKey);
	const settings = settingsObj
		? ((await settingsObj.json()) as Record<string, unknown>)
		: {};
	const coverUpdatedAt = new Date().toISOString();
	const nextSettings = { ...settings, coverUpdatedAt };
	await c.env.BUCKET.put(settingsKey, JSON.stringify(nextSettings));

	void recordAudit(c.var.mailboxStub, {
		actor_email: getAuditActor(c, mailboxId),
		action: "mailbox.cover_update",
		target_type: "mailbox",
		target_id: mailboxId,
	});

	return c.json({ coverUpdatedAt });
});

app.use("/api/v1/mailboxes/:mailboxId/*", requireMailbox);

// -- Config ---------------------------------------------------------

app.get("/api/v1/boards", async (c) => {
	const boards = await listAccessibleBoards(c.env, c.var.accessEmail);
	return c.json(boards);
});

app.get("/api/v1/config", async (c) => {
	const config = await getDomainConfig(c.env);
	const emailAddresses = filterMailboxIdsForAccess(
		config.emailAddresses,
		c.var.accessEmail,
		await getMailboxAccessOptions(c),
	);
	const accessEmail = c.var.accessEmail || null;
	const isAdmin =
		!!accessEmail &&
		config.accessEmailAddresses.includes(accessEmail.toLowerCase());
	return c.json({
		domains: config.domains,
		emailAddresses,
		accessEmail,
		isAdmin,
	});
});

app.get("/api/v1/admin/domains", async (c) => {
	try {
		const config = await getDomainConfig(c.env);
		assertAdminAccess(c.var.accessEmail, config.accessEmailAddresses);
		return c.json(config);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}
});

app.put("/api/v1/admin/domains", async (c) => {
	try {
		const current = await getDomainConfig(c.env);
		assertAdminAccess(c.var.accessEmail, current.accessEmailAddresses);
		const body = DomainConfigBody.parse(await c.req.json());
		const next = await updateDomainConfig(c.env, body);
		return c.json(next);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: error.issues[0]?.message || "Invalid domain config" }, 400);
		}
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}
});

app.post("/api/public/signup-requests", async (c) => {
	let payload: unknown;
	try {
		payload = await c.req.json();
	} catch {
		return c.json({ error: "Invalid JSON body" }, 400);
	}
	const parsed = SignupRequestBody.safeParse(payload);
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message || "Invalid signup request" }, 400);
	}
	const body = parsed.data;
	if (!body.desiredMailbox.toLowerCase().endsWith("@vsbg.vn")) {
		return c.json({ error: "Mailbox must use @vsbg.vn" }, 400);
	}

	const requestId = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	await c.env.BUCKET.put(
		`signup-requests/${createdAt.replace(/[:.]/g, "-")}-${requestId}.json`,
		JSON.stringify({
			id: requestId,
			status: "pending",
			createdAt,
			...body,
		}, null, 2),
		{ httpMetadata: { contentType: "application/json" } },
	);

	return c.json({ id: requestId, status: "received" }, 202);
});

// -- Mailboxes ------------------------------------------------------

app.get("/api/v1/mailboxes", async (c) => {
	const allMailboxes = await listMailboxes(c.env.BUCKET);
	const accessOptions = await getMailboxAccessOptions(c);
	const visibleMailboxIds = new Set(
		filterMailboxIdsForAccess(
			allMailboxes.map((mailbox) => mailbox.id),
			c.var.accessEmail,
			accessOptions,
		),
	);

	const explicitVisible = new Set<string>();
	for (const mailbox of allMailboxes) {
		if (visibleMailboxIds.has(mailbox.id)) {
			explicitVisible.add(mailbox.id);
			continue;
		}
		const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailbox.id));
		const role = await resolveMailboxRole(
			c.var.accessEmail,
			mailbox.id,
			accessOptions,
			(email) => stub.getExplicitMailboxRole(email),
		);
		if (role) explicitVisible.add(mailbox.id);
	}

	const visible = allMailboxes.filter((mailbox) =>
		explicitVisible.has(mailbox.id),
	);
	const enriched = await Promise.all(
		visible.map(async (mailbox) => {
			const settings = await loadMailboxSettings(c.env.BUCKET, mailbox.id);
			return { ...mailbox, name: mailbox.id, settings };
		}),
	);
	return c.json(enriched);
});

app.post("/api/v1/mailboxes", async (c) => {
	const { name, settings, email: rawEmail } = CreateMailboxBody.parse(await c.req.json());
	const email = rawEmail.toLowerCase();
	const accessOptions = await getMailboxAccessOptions(c);
	try {
		assertMailboxAccess(c.var.accessEmail, email, accessOptions);
	} catch (error) {
		if (error instanceof AccessAuthorizationError) {
			return c.json({ error: error.message }, 403);
		}
		throw error;
	}
	const domainConfig = await getDomainConfig(c.env);
	const allowedAddresses = domainConfig.emailAddresses;
	if (allowedAddresses.length > 0 && !allowedAddresses.map((a) => a.toLowerCase()).includes(email)) {
		return c.json({ error: "Mailbox creation is restricted to configured EMAIL_ADDRESSES" }, 403);
	}
	const key = `mailboxes/${email}.json`;
	if (await c.env.BUCKET.head(key)) return c.json({ error: "Mailbox already exists" }, 409);
	const defaultSettings = { fromName: name, forwarding: { enabled: false, email: "" }, signature: { enabled: false, text: "" }, autoReply: { enabled: false, subject: "", message: "" } };
	const finalSettings = { ...defaultSettings, ...settings };
	await c.env.BUCKET.put(key, JSON.stringify(finalSettings));
	const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(email));
	await stub.getFolders();
	void recordAudit(stub, {
		actor_email: getAuditActor(c, email),
		action: "mailbox.create",
		target_type: "mailbox",
		target_id: email,
	});
	return c.json({ id: email, email, name, settings: finalSettings }, 201);
});

app.get("/api/v1/mailboxes/:mailboxId", async (c) => {
	const mailboxId = c.req.param("mailboxId")!;
	const obj = await c.env.BUCKET.get(`mailboxes/${mailboxId}.json`);
	if (!obj) return c.json({ error: "Not found" }, 404);
	return c.json({ id: mailboxId, name: mailboxId, email: mailboxId, settings: await obj.json() });
});

app.put("/api/v1/mailboxes/:mailboxId", async (c) => {
	const mailboxId = c.req.param("mailboxId")!;
	const key = `mailboxes/${mailboxId}.json`;
	if (!(await c.env.BUCKET.head(key))) return c.json({ error: "Not found" }, 404);

	const accessOptions = await getMailboxAccessOptions(c);
	const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
	const role = await resolveMailboxRole(
		c.var.accessEmail,
		mailboxId,
		accessOptions,
		(email) => stub.getExplicitMailboxRole(email),
	);
	try {
		assertContextPermission(role, "settings");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	const { settings } = (await c.req.json()) as { settings: Record<string, unknown> };
	await c.env.BUCKET.put(key, JSON.stringify(settings));
	void recordAudit(stub, {
		actor_email: getAuditActor(c, mailboxId),
		action: "mailbox.settings_update",
		target_type: "mailbox",
		target_id: mailboxId,
	});
	return c.json({ id: mailboxId, name: mailboxId, email: mailboxId, settings });
});

app.delete("/api/v1/mailboxes/:mailboxId", async (c) => {
	const mailboxId = c.req.param("mailboxId")!;
	const key = `mailboxes/${mailboxId}.json`;
	if (!(await c.env.BUCKET.head(key))) return c.json({ error: "Not found" }, 404);

	try {
		const config = await getDomainConfig(c.env);
		assertAdminAccess(c.var.accessEmail, config.accessEmailAddresses);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}

	const stub = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(mailboxId));
	const attachmentKeys = await stub.collectMailboxAttachmentKeys();
	if (attachmentKeys.length > 0) {
		await c.env.BUCKET.delete(attachmentKeys);
	}

	const doId = c.env.MAILBOX.idFromName(mailboxId);
	await (
		c.env.MAILBOX as unknown as {
			delete: (id: DurableObjectId) => Promise<void>;
		}
	).delete(doId);
	await c.env.BUCKET.delete(key);
	await c.env.BUCKET.delete(profileAvatarKey(mailboxId));
	await c.env.BUCKET.delete(profileCoverKey(mailboxId));

	return c.body(null, 204);
});

// -- Emails ---------------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/emails", async (c: AppContext) => {
	const folder = c.req.query("folder");
	const thread_id = c.req.query("thread_id");
	const threaded = boolQuery(c, "threaded");
	const page = intQuery(c, "page");
	const limit = intQuery(c, "limit");
	const sortColumn = c.req.query("sortColumn") as any;
	const sortDirection = c.req.query("sortDirection") as "ASC" | "DESC" | undefined;
	const stub = c.var.mailboxStub;

	if (threaded && folder) {
		const emails = await (stub as any).getThreadedEmails({ folder, page, limit });
		const totalCount = await (stub as any).countThreadedEmails(folder);
		return c.json({ emails, totalCount });
	}
	const emails = await stub.getEmails({ folder, thread_id, page, limit, sortColumn, sortDirection });
	if (folder) {
		const totalCount = await stub.countEmails({ folder, thread_id });
		return c.json({ emails, totalCount });
	}
	return c.json(emails);
});

app.post("/api/v1/mailboxes/:mailboxId/emails", async (c: AppContext) => {
	try {
		requirePermission(c, "send");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	const mailboxId = c.req.param("mailboxId")!;
	const body = SendEmailRequestSchema.parse(await c.req.json());
	const { to, cc, bcc, from, subject, html, text, attachments, in_reply_to, references, thread_id } = body;

	let toStr: string, fromEmail: string, fromDomain: string;
	try {
		({ toStr, fromEmail, fromDomain } = validateSender(to, from, mailboxId));
	} catch (e) {
		if (e instanceof SenderValidationError) return c.json({ error: e.message }, 400);
		throw e;
	}

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);
	const stub = c.var.mailboxStub;
	const rateLimitError = await (stub as any).checkSendRateLimit();
	if (rateLimitError) return c.json({ error: rateLimitError }, 429);
	const routing = getRecipientRouting(c.env, { to, cc, bcc });
	if (routing.hasExternalRecipients) {
		return c.json({
			error: getInternalOnlyDeliveryError(routing.externalRecipients),
		}, 403);
	}
	try {
		await assertOutboundRecipientsAllowed(
			c.env,
			c.var.accessEmail,
			{ to, cc, bcc },
			{ isNewTopic: isNewTopicSend({ in_reply_to, thread_id }) },
		);
	} catch (error) {
		if (error instanceof BoardAccessError) {
			return c.json({ error: error.message }, 403);
		}
		throw error;
	}
	const attachmentData = await storeAttachments(c.env.BUCKET, messageId, attachments);

	await stub.createEmail(Folders.SENT, {
		id: messageId, subject, sender: fromEmail, recipient: toStr,
		cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc).toLowerCase() : null,
		bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc).toLowerCase() : null,
		date: new Date().toISOString(), body: html || text || "",
		in_reply_to: in_reply_to || null, email_references: references ? JSON.stringify(references) : null,
		thread_id: thread_id || in_reply_to || messageId, message_id: outgoingMessageId,
		raw_headers: JSON.stringify([
			{ key: "from", value: typeof from === "string" ? from : `${from.name} <${from.email}>` },
			{ key: "to", value: Array.isArray(to) ? to.join(", ") : to },
			...(cc ? [{ key: "cc", value: Array.isArray(cc) ? cc.join(", ") : cc }] : []),
			...(bcc ? [{ key: "bcc", value: Array.isArray(bcc) ? bcc.join(", ") : bcc }] : []),
			{ key: "subject", value: subject }, { key: "date", value: new Date().toISOString() },
			{ key: "message-id", value: `<${outgoingMessageId}>` },
		]),
	}, attachmentData);

	const deliveryAttachments = attachments?.map((att) => ({
		content: att.content,
		filename: att.filename,
		type: att.type,
		disposition: att.disposition || "attachment",
		contentId: att.contentId,
	}));
	if (routing.internalRecipients.length > 0) {
		await deliverInternalEmail(c.env, {
			to, cc, bcc, from, subject, html, text,
			attachments: deliveryAttachments,
			inReplyTo: in_reply_to || null,
			references,
			threadId: thread_id || in_reply_to || null,
			outgoingMessageId,
		});
	}
	void recordAudit(stub, {
		actor_email: getAuditActor(c, mailboxId),
		action: "email.send",
		target_type: "email",
		target_id: messageId,
		payload: { subject, recipient: toStr },
	});
	return c.json({ id: messageId, status: "sent" }, 202);
});

app.post("/api/v1/mailboxes/:mailboxId/drafts", async (c: AppContext) => {
	try {
		requirePermission(c, "send");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	const mailboxId = c.req.param("mailboxId")!;
	const { to, cc, bcc, subject, body, in_reply_to, thread_id, draft_id } = DraftBody.parse(await c.req.json());
	const stub = c.var.mailboxStub;
	if (draft_id) await stub.deleteEmail(draft_id); // not atomic — create-then-delete would be safer
	const messageId = crypto.randomUUID();
	const now = new Date().toISOString();
	await stub.createEmail(Folders.DRAFT, {
		id: messageId, subject: subject || "", sender: mailboxId.toLowerCase(),
		recipient: (to || "").toLowerCase(), cc: cc?.toLowerCase() || null, bcc: bcc?.toLowerCase() || null,
		date: now, body, in_reply_to: in_reply_to || null, email_references: null,
		thread_id: thread_id || in_reply_to || messageId,
	}, []);
	void recordAudit(stub, {
		actor_email: getAuditActor(c, mailboxId),
		action: "draft.save",
		target_type: "email",
		target_id: messageId,
		payload: { subject: subject || "" },
	});
	return c.json({ id: messageId, status: "draft", subject: subject || "", recipient: to || "", date: now }, 201);
});

app.get("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	const emailId = c.req.param("id")!;
	const email = await c.var.mailboxStub.getEmail(emailId);
	if (!email) return c.json({ error: "Email not found" }, 404);
	void recordAudit(c.var.mailboxStub, {
		actor_email: getAuditActor(c, c.req.param("mailboxId")!),
		action: "email.read",
		target_type: "email",
		target_id: emailId,
	});
	return new Response(JSON.stringify(email), {
		headers: { "Content-Type": "application/json" },
	});
});

app.put("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	const { read, starred } = (await c.req.json()) as { read?: boolean; starred?: boolean };
	const email = await c.var.mailboxStub.updateEmail(c.req.param("id")!, { read, starred });
	return email ? c.json(email) : c.json({ error: "Email not found" }, 404);
});

app.delete("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	try {
		requirePermission(c, "delete");
	} catch (error) {
		return handlePermissionError(c, error);
	}

	const id = c.req.param("id")!;
	const attachments = await c.var.mailboxStub.deleteEmail(id);
	if (attachments === null) return c.json({ error: "Not found" }, 404);
	if (attachments.length > 0) await c.env.BUCKET.delete(attachments.map((att: any) => `attachments/${id}/${att.id}/${att.filename}`));
	void recordAudit(c.var.mailboxStub, {
		actor_email: getAuditActor(c, c.req.param("mailboxId")!),
		action: "email.delete",
		target_type: "email",
		target_id: id,
	});
	return c.body(null, 204);
});

app.post("/api/v1/mailboxes/:mailboxId/emails/:id/move", async (c: AppContext) => {
	const emailId = c.req.param("id")!;
	const { folderId } = (await c.req.json()) as { folderId: string };
	const success = await c.var.mailboxStub.moveEmail(emailId, folderId);
	if (!success) return c.json({ error: "Folder not found" }, 400);
	void recordAudit(c.var.mailboxStub, {
		actor_email: getAuditActor(c, c.req.param("mailboxId")!),
		action: "email.move",
		target_type: "email",
		target_id: emailId,
		payload: { folderId },
	});
	return c.json({ status: "moved" });
});

// -- Contacts -------------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/contacts/:emailAddress", async (c: AppContext) => {
	const emailAddress = decodeURIComponent(c.req.param("emailAddress")!);
	const profile = await (c.var.mailboxStub as any).getContactProfile(emailAddress);
	return profile ? c.json(profile) : c.json({ error: "Contact not found" }, 404);
});

app.patch("/api/v1/mailboxes/:mailboxId/contacts/:emailAddress", async (c: AppContext) => {
	try {
		const emailAddress = decodeURIComponent(c.req.param("emailAddress")!);
		z.string().email().parse(emailAddress);
		const patch = ContactProfilePatchBody.parse(await c.req.json());
		return c.json(await (c.var.mailboxStub as any).updateContactProfile(emailAddress, patch));
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Invalid contact profile" }, 400);
	}
});

// -- Threads --------------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/threads/:threadId", async (c: AppContext) => {
	return c.json(await (c.var.mailboxStub as any).getThreadEmails(c.req.param("threadId")!));
});

app.get("/api/v1/mailboxes/:mailboxId/threads/:threadId/state", async (c: AppContext) => {
	return c.json(await (c.var.mailboxStub as any).getConversationState(c.req.param("threadId")!));
});

app.patch("/api/v1/mailboxes/:mailboxId/threads/:threadId/state", async (c: AppContext) => {
	try {
		const threadId = c.req.param("threadId")!;
		const patch = normalizeConversationStatePatch(await c.req.json());
		const result = await (c.var.mailboxStub as any).updateConversationState(threadId, patch);
		void recordAudit(c.var.mailboxStub, {
			actor_email: getAuditActor(c, c.req.param("mailboxId")!),
			action: "conversation.state_update",
			target_type: "thread",
			target_id: threadId,
			payload: patch,
		});
		return c.json(result);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Invalid conversation state" }, 400);
	}
});

app.get("/api/v1/mailboxes/:mailboxId/threads/:threadId/notes", async (c: AppContext) => {
	return c.json(await (c.var.mailboxStub as any).listInternalNotes(c.req.param("threadId")!));
});

app.post("/api/v1/mailboxes/:mailboxId/threads/:threadId/notes", async (c: AppContext) => {
	try {
		const body = await c.req.json();
		const noteBody = normalizeInternalNoteBody((body as { body?: unknown }).body);
		const threadId = c.req.param("threadId")!;
		const note = await (c.var.mailboxStub as any).createInternalNote(
			threadId,
			c.var.accessEmail || c.req.param("mailboxId")!,
			noteBody,
		);
		void recordAudit(c.var.mailboxStub, {
			actor_email: getAuditActor(c, c.req.param("mailboxId")!),
			action: "note.create",
			target_type: "thread",
			target_id: threadId,
			payload: { noteId: note.id },
		});
		return c.json(note, 201);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Invalid internal note" }, 400);
	}
});

app.get("/api/v1/mailboxes/:mailboxId/permissions", async (c: AppContext) => {
	try {
		requirePermission(c, "manage");
	} catch (error) {
		return handlePermissionError(c, error);
	}
	return c.json(await c.var.mailboxStub.listMailboxPermissions());
});

app.post("/api/v1/mailboxes/:mailboxId/permissions", async (c: AppContext) => {
	try {
		requirePermission(c, "manage");
	} catch (error) {
		return handlePermissionError(c, error);
	}
	const body = PermissionGrantBody.parse(await c.req.json());
	const granted = await c.var.mailboxStub.grantMailboxPermission(
		body.userEmail,
		body.role,
		getAuditActor(c, c.req.param("mailboxId")!),
	);
	return c.json(granted, 201);
});

app.delete("/api/v1/mailboxes/:mailboxId/permissions/:userEmail", async (c: AppContext) => {
	try {
		requirePermission(c, "manage");
	} catch (error) {
		return handlePermissionError(c, error);
	}
	const userEmail = decodeURIComponent(c.req.param("userEmail")!);
	const ok = await c.var.mailboxStub.revokeMailboxPermission(
		userEmail,
		getAuditActor(c, c.req.param("mailboxId")!),
	);
	if (!ok) return c.json({ error: "Permission not found" }, 404);
	return c.body(null, 204);
});

app.get("/api/v1/mailboxes/:mailboxId/audit", async (c: AppContext) => {
	try {
		const config = await getDomainConfig(c.env);
		assertAuditAdminAccess(c.var.accessEmail, config.accessEmailAddresses);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}

	const options = normalizeAuditListOptions({
		page: intQuery(c, "page"),
		limit: intQuery(c, "limit"),
		action: c.req.query("action"),
		actor: c.req.query("actor"),
		from: c.req.query("from"),
		to: c.req.query("to"),
	});

	return c.json(await (c.var.mailboxStub as any).listAuditEntries(options));
});

app.get("/api/v1/mailboxes/:mailboxId/retention/stats", async (c: AppContext) => {
	try {
		const config = await getDomainConfig(c.env);
		assertAuditAdminAccess(c.var.accessEmail, config.accessEmailAddresses);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}

	return c.json(await (c.var.mailboxStub as any).getRetentionStats());
});

const RetentionRunBody = z.object({
	trashDays: z.number().int().min(0).max(30).optional(),
	sentDays: z.number().int().min(0).max(365).optional(),
});

app.post("/api/v1/mailboxes/:mailboxId/retention/run", async (c: AppContext) => {
	try {
		const config = await getDomainConfig(c.env);
		assertAuditAdminAccess(c.var.accessEmail, config.accessEmailAddresses);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Forbidden" }, 403);
	}

	let policy = {};
	try {
		const rawBody = await c.req.json().catch(() => ({}));
		policy = normalizeRetentionPolicyOptions(RetentionRunBody.parse(rawBody));
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Invalid retention policy" }, 400);
	}

	const result = await (c.var.mailboxStub as any).runRetention(
		getAuditActor(c, c.req.param("mailboxId")!),
		policy,
	);
	return c.json(result);
});

app.get("/api/v1/mailboxes/:mailboxId/threads/:threadId/events", async (c: AppContext) => {
	return c.json(await (c.var.mailboxStub as any).listConversationEvents(c.req.param("threadId")!));
});

app.post("/api/v1/mailboxes/:mailboxId/threads/:threadId/read", async (c: AppContext) => {
	await c.var.mailboxStub.markThreadRead(c.req.param("threadId")!);
	return c.json({ status: "marked_read" });
});

// -- Reply / Forward ------------------------------------------------

app.post("/api/v1/mailboxes/:mailboxId/emails/:id/reply", handleReplyEmail);
app.post("/api/v1/mailboxes/:mailboxId/emails/:id/forward", (c) => {
	if (!ALLOW_FORWARDING) {
		return c.json({ error: "Forwarding is disabled in V1" }, 404);
	}
	return handleForwardEmail(c);
});

// -- Folders --------------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/folders", async (c: AppContext) => c.json(await c.var.mailboxStub.getFolders()));

app.post("/api/v1/mailboxes/:mailboxId/folders", async (c: AppContext) => {
	const { name } = (await c.req.json()) as { name: string };
	const slug = slugify(name);
	if (!slug) return c.json({ error: "Folder name must contain alphanumeric characters" }, 400);
	const f = await c.var.mailboxStub.createFolder(slug, name);
	return f ? c.json(f, 201) : c.json({ error: "Folder with this name already exists" }, 409);
});

app.put("/api/v1/mailboxes/:mailboxId/folders/:id", async (c: AppContext) => {
	const { name } = (await c.req.json()) as { name: string };
	const f = await c.var.mailboxStub.updateFolder(c.req.param("id")!, name);
	return f ? c.json(f) : c.json({ error: "Folder not found" }, 404);
});

app.delete("/api/v1/mailboxes/:mailboxId/folders/:id", async (c: AppContext) => {
	const ok = await c.var.mailboxStub.deleteFolder(c.req.param("id")!);
	return ok ? c.body(null, 204) : c.json({ error: "Folder not found or cannot be deleted" }, 400);
});

// -- Search ---------------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/search", async (c: AppContext) => {
	const searchOpts: Record<string, unknown> = {
		query: c.req.query("query") || "", folder: c.req.query("folder"), from: c.req.query("from"),
		to: c.req.query("to"), subject: c.req.query("subject"), date_start: c.req.query("date_start"),
		date_end: c.req.query("date_end"), is_read: boolQuery(c, "is_read"),
		is_starred: boolQuery(c, "is_starred"), has_attachment: boolQuery(c, "has_attachment"),
	};
	const stub = c.var.mailboxStub as any;
	const emails = await stub.searchEmails({ ...searchOpts, page: intQuery(c, "page"), limit: intQuery(c, "limit") });
	const totalCount = await stub.countSearchResults(searchOpts);
	return c.json({ emails, totalCount });
});

// -- Attachments ----------------------------------------------------

app.get("/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId", async (c: AppContext) => {
	const emailId = c.req.param("emailId")!;
	const attachmentId = c.req.param("attachmentId")!;
	const attachment = await c.var.mailboxStub.getAttachment(attachmentId);
	if (!attachment) return c.json({ error: "Attachment not found" }, 404);
	try {
		assertAttachmentBelongsToEmail(attachment, emailId);
	} catch {
		return c.json({ error: "Attachment not found" }, 404);
	}
	const obj = await c.env.BUCKET.get(`attachments/${emailId}/${attachmentId}/${attachment.filename}`);
	if (!obj) return c.json({ error: "Attachment file not found" }, 404);
	const headers = new Headers();
	headers.set("Content-Type", attachment.mimetype);
	const sanitized = attachment.filename.replace(/[\x00-\x1f"\\]/g, "_");
	headers.set("Content-Disposition", `attachment; filename="${sanitized}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
	return new Response(obj.body, { headers });
});

// -- Receive inbound email ------------------------------------------

const MAX_EMAIL_SIZE = 25 * 1024 * 1024;

async function streamToArrayBuffer(stream: ReadableStream, streamSize: number) {
	if (streamSize > MAX_EMAIL_SIZE) throw new Error(`Email too large: ${streamSize} bytes exceeds ${MAX_EMAIL_SIZE} byte limit`);
	if (streamSize <= 0) throw new Error(`Invalid stream size: ${streamSize}`);
	const result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (bytesRead + value.length > streamSize) { reader.cancel(); throw new Error(`Stream exceeds declared size`); }
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
}

async function receiveEmail(event: { raw: ReadableStream; rawSize: number }, env: Env, ctx: ExecutionContext) {
	const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
	const parsedEmail = await new PostalMime().parse(rawEmail);

	if (!parsedEmail.to?.length || !parsedEmail.to[0].address) throw new Error("received email with empty to");

	const allowedAddresses = ((env.EMAIL_ADDRESSES ?? []) as string[]).map((a) => a.toLowerCase());
	const allRecipients = parsedEmail.to.map((t) => t.address?.toLowerCase()).filter(Boolean) as string[];
	const ccRecipients = (parsedEmail.cc || []).map((e) => e.address?.toLowerCase()).filter(Boolean) as string[];
	const bccRecipients = (parsedEmail.bcc || []).map((e) => e.address?.toLowerCase()).filter(Boolean) as string[];

	let mailboxId: string | undefined;
	if (allowedAddresses.length > 0) {
		mailboxId = allRecipients.find((addr) => allowedAddresses.includes(addr));
		if (!mailboxId) { console.log(`Ignoring email: no recipient matches EMAIL_ADDRESSES.`); return; }
	} else { mailboxId = allRecipients[0]; }
	if (!mailboxId) throw new Error("received email with no valid recipient address");

	const messageId = crypto.randomUUID();
	if (!(await env.BUCKET.head(`mailboxes/${mailboxId}.json`))) { console.log(`Ignoring email for ${mailboxId}: mailbox does not exist`); return; }

	const stub = env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId));

	const attachmentData: StoredAttachment[] = [];
	if (parsedEmail.attachments) {
		for (const att of parsedEmail.attachments) {
			const attId = crypto.randomUUID();
			const filename = (att.filename || "untitled").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_");
			const attachmentSize = typeof att.content === "string"
				? att.content.length
				: att.content.byteLength;
			if (!isAllowedInboundImageAttachment({
				type: att.mimeType,
				size: attachmentSize,
			})) {
				console.log(`Ignoring unsupported inbound attachment: ${filename}`);
				continue;
			}
			await env.BUCKET.put(`attachments/${messageId}/${attId}/${filename}`, att.content);
			attachmentData.push({ id: attId, email_id: messageId, filename, mimetype: att.mimeType,
				size: attachmentSize,
				content_id: att.contentId || null, disposition: att.disposition || "attachment" });
		}
	}

	const extractMsgId = (s: string) => { const m = s.match(/<([^>]+)>/); return m ? m[1] : s.trim().split(/\s+/)[0]; };
	const inReplyTo = parsedEmail.inReplyTo ? extractMsgId(parsedEmail.inReplyTo) : null;
	const emailReferences = parsedEmail.references ? parsedEmail.references.split(/\s+/).filter(Boolean).map(extractMsgId) : [];
	let threadId = emailReferences[0] || inReplyTo || messageId;

	if (!inReplyTo && emailReferences.length === 0) {
		const subjectThread = await (stub as any).findThreadBySubject(parsedEmail.subject || "", parsedEmail.from?.address || undefined);
		if (subjectThread) threadId = subjectThread;
	}

	const originalMessageId = parsedEmail.messageId ? extractMsgId(parsedEmail.messageId) : null;

	await stub.createEmail(Folders.INBOX, {
		id: messageId, subject: parsedEmail.subject || "",
		sender: (parsedEmail.from?.address || "").toLowerCase(), recipient: allRecipients.join(", "),
		cc: ccRecipients.join(", ") || null, bcc: bccRecipients.join(", ") || null,
		date: new Date().toISOString(), // uses receive time, not the email's Date header
		body: parsedEmail.html || parsedEmail.text || "",
		in_reply_to: inReplyTo, email_references: emailReferences.length > 0 ? JSON.stringify(emailReferences) : null,
		thread_id: threadId, message_id: originalMessageId, raw_headers: JSON.stringify(parsedEmail.headers),
	}, attachmentData);

}

export { app, receiveEmail };
