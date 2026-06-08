// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context } from "hono";
import { storeAttachments } from "../lib/attachments";
import { deliverInternalEmail } from "../lib/internal-delivery";
import { getInternalOnlyDeliveryError, getRecipientRouting } from "../lib/recipient-routing";
import type { EmailFull } from "../lib/schemas";
import {
	validateSender,
	SenderValidationError,
	generateMessageId,
	buildReferencesChain,
	resolveOriginalEmail,
} from "../lib/email-helpers";
import { SendEmailRequestSchema } from "../lib/schemas";
import {
	assertOutboundRecipientsAllowed,
	BoardAccessError,
} from "../lib/boards";
import { Folders } from "../../shared/folders";
import type { MailboxContext } from "../lib/mailbox";

type AppContext = Context<MailboxContext>;
type RateLimitStub = { checkSendRateLimit: () => Promise<string | null> };

export async function handleReplyEmail(c: AppContext) {
	const mailboxId = c.req.param("mailboxId") ?? "";
	const id = c.req.param("id") ?? "";
	const body = SendEmailRequestSchema.parse(await c.req.json());
	const { to, cc, bcc, from, subject, html, text, attachments } = body;

	const stub = c.var.mailboxStub;
	const rawOriginal = (await stub.getEmail(id)) as EmailFull | null;

	if (!rawOriginal) {
		return c.json({ error: "Original email not found" }, 404);
	}

	const originalEmail = await resolveOriginalEmail(stub, rawOriginal);
	const { originalMsgId, references, threadId: thread_id } = buildReferencesChain(originalEmail);

	let toStr: string, fromEmail: string, fromDomain: string;
	try {
		({ toStr, fromEmail, fromDomain } = validateSender(to, from, mailboxId));
	} catch (e) {
		if (e instanceof SenderValidationError) return c.json({ error: e.message }, 400);
		throw e;
	}

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);

	const rateLimitError = await (stub as unknown as RateLimitStub)
		.checkSendRateLimit();
	if (rateLimitError) {
		return c.json({ error: rateLimitError }, 429);
	}
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
			{ isNewTopic: false },
		);
	} catch (error) {
		if (error instanceof BoardAccessError) {
			return c.json({ error: error.message }, 403);
		}
		throw error;
	}

	const attachmentData = await storeAttachments(c.env.BUCKET, messageId, attachments);

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject,
			sender: fromEmail,
			recipient: toStr,
			cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc).toLowerCase() : null,
			bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc).toLowerCase() : null,
			date: new Date().toISOString(),
			body: html || text || "",
			in_reply_to: originalMsgId,
			email_references: JSON.stringify(references),
			thread_id: thread_id,
			message_id: outgoingMessageId,
			raw_headers: JSON.stringify([
				{ key: "from", value: typeof from === "string" ? from : `${from.name} <${from.email}>` },
				{ key: "to", value: Array.isArray(to) ? to.join(", ") : to },
				...(cc ? [{ key: "cc", value: Array.isArray(cc) ? cc.join(", ") : cc }] : []),
				...(bcc ? [{ key: "bcc", value: Array.isArray(bcc) ? bcc.join(", ") : bcc }] : []),
				{ key: "subject", value: subject },
				{ key: "date", value: new Date().toISOString() },
				{ key: "message-id", value: `<${outgoingMessageId}>` },
				...(originalMsgId ? [{ key: "in-reply-to", value: `<${originalMsgId}>` }] : []),
				...(references.length > 0 ? [{ key: "references", value: references.map((r: string) => `<${r}>`).join(" ") }] : []),
			]),
		},
		attachmentData,
	);

	await stub.markThreadRead(thread_id);

	const deliveryAttachments = attachments?.map((att) => ({
		content: att.content,
		filename: att.filename,
		type: att.type,
		disposition: att.disposition,
		contentId: att.contentId,
	}));
	if (routing.internalRecipients.length > 0) {
		await deliverInternalEmail(c.env, {
			to, cc, bcc, from, subject, html, text,
			attachments: deliveryAttachments,
			inReplyTo: originalMsgId,
			references,
			threadId: thread_id,
			outgoingMessageId,
		});
	}

	return c.json({ id: messageId, status: "sent" }, 202);
}

export async function handleForwardEmail(c: AppContext) {
	const mailboxId = c.req.param("mailboxId") ?? "";
	const id = c.req.param("id") ?? "";
	const body = SendEmailRequestSchema.parse(await c.req.json());
	const { to, cc, bcc, from, subject, html, text, attachments } = body;

	const stub = c.var.mailboxStub;
	const rawOriginal = (await stub.getEmail(id)) as EmailFull | null;

	if (!rawOriginal) {
		return c.json({ error: "Original email not found" }, 404);
	}

	await resolveOriginalEmail(stub, rawOriginal);

	let toStr: string, fromEmail: string, fromDomain: string;
	try {
		({ toStr, fromEmail, fromDomain } = validateSender(to, from, mailboxId));
	} catch (e) {
		if (e instanceof SenderValidationError) return c.json({ error: e.message }, 400);
		throw e;
	}

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);

	const rateLimitError = await (stub as unknown as RateLimitStub)
		.checkSendRateLimit();
	if (rateLimitError) {
		return c.json({ error: rateLimitError }, 429);
	}
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
			{ isNewTopic: false },
		);
	} catch (error) {
		if (error instanceof BoardAccessError) {
			return c.json({ error: error.message }, 403);
		}
		throw error;
	}

	const attachmentData = await storeAttachments(c.env.BUCKET, messageId, attachments);

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject,
			sender: fromEmail,
			recipient: toStr,
			cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc).toLowerCase() : null,
			bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc).toLowerCase() : null,
			date: new Date().toISOString(),
			body: html || text || "",
			in_reply_to: null,
			email_references: null,
			thread_id: messageId,
			message_id: outgoingMessageId,
			raw_headers: JSON.stringify([
				{ key: "from", value: typeof from === "string" ? from : `${from.name} <${from.email}>` },
				{ key: "to", value: Array.isArray(to) ? to.join(", ") : to },
				...(cc ? [{ key: "cc", value: Array.isArray(cc) ? cc.join(", ") : cc }] : []),
				...(bcc ? [{ key: "bcc", value: Array.isArray(bcc) ? bcc.join(", ") : bcc }] : []),
				{ key: "subject", value: subject },
				{ key: "date", value: new Date().toISOString() },
				{ key: "message-id", value: `<${outgoingMessageId}>` },
			]),
		},
		attachmentData,
	);

	const deliveryAttachments = attachments?.map((att) => ({
		content: att.content,
		filename: att.filename,
		type: att.type,
		disposition: att.disposition,
		contentId: att.contentId,
	}));
	if (routing.internalRecipients.length > 0) {
		await deliverInternalEmail(c.env, {
			to, cc, bcc, from, subject, html, text,
			attachments: deliveryAttachments,
			threadId: messageId,
			outgoingMessageId,
		});
	}

	return c.json({ id: messageId, status: "sent" }, 202);
}
