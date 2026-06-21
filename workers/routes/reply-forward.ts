import type { Context } from "hono"
import type { MailboxContext } from "../lib/mailbox"

export async function handleReplyEmail(c: Context<MailboxContext>) {
	return c.json({ error: "Reply not implemented in demo" }, 501)
}

export async function handleForwardEmail(c: Context<MailboxContext>) {
	return c.json({ error: "Forward not implemented in demo" }, 501)
}
