// ── Bad word list (basic profanity filter) ────────────────────────

const BAD_WORDS = new Set([
	"fuck", "shit", "damn", "bitch", "dick", "pussy", "asshole",
	"bastard", "cunt", "whore", "slut", "faggot", "nigger",
	"cứt", "địt", "lồn", "buồi", "cặc", "đéo", "dâm", "vãi lồn",
	"dm", "clgt", "vl", "đmm", "đjt", "vcl",
])

const RATE_LIMIT_WINDOW_MS = 1000 // 1 second per user

const rateLimitMap = new Map<string, number>()

export function validateChatMessage(
	msg: string,
): { ok: true; sanitized: string } | { ok: false; error: string } {
	if (!msg || typeof msg !== "string") {
		return { ok: false, error: "Message is required" }
	}

	const trimmed = msg.trim()
	if (trimmed.length === 0) {
		return { ok: false, error: "Message cannot be empty" }
	}

	if (trimmed.length > 500) {
		return { ok: false, error: "Message too long (max 500 chars)" }
	}

	const sanitized = sanitizeHtml(trimmed)
	const filtered = filterBadWords(sanitized)

	return { ok: true, sanitized: filtered }
}

export function checkRateLimit(userKey: string): boolean {
	const now = Date.now()
	const last = rateLimitMap.get(userKey)

	if (last && now - last < RATE_LIMIT_WINDOW_MS) {
		return false // rate limited
	}

	rateLimitMap.set(userKey, now)

	// Cleanup old entries every 1000 messages
	if (rateLimitMap.size > 1000) {
		const cutoff = now - RATE_LIMIT_WINDOW_MS
		for (const [key, time] of rateLimitMap) {
			if (time < cutoff) rateLimitMap.delete(key)
		}
	}

	return true
}

function sanitizeHtml(input: string): string {
	return input
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;")
}

function filterBadWords(input: string): string {
	let result = input
	for (const word of BAD_WORDS) {
		const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi")
		result = result.replace(regex, "*".repeat(word.length))
	}
	return result
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
