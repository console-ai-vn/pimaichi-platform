import type { Env } from "./types"

export async function sendEmail(env: Env, options: { to: string; subject: string; html?: string; text?: string }) {
	console.log("sendEmail stub:", options.to, options.subject)
}
