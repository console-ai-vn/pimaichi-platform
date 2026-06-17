import { Hono } from "hono"
import { z } from "zod"
import { normalizeEmail } from "../lib/access"
import { getLiveStub } from "../lib/live-stub"
import { getPaymentStub } from "../lib/payment-stub"
import type { AccessVariables, Env } from "../types"

type LiveContext = {
	Bindings: Env
	Variables: AccessVariables
}

const app = new Hono<LiveContext>()

// ── Schemas ───────────────────────────────────────────────────────

const CreateEventBody = z.object({
	creatorMailboxId: z.string().email(),
	title: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	scheduledAt: z.string().optional(),
	passPrice: z.number().int().min(0).optional(),
})

const JoinBody = z.object({
	userEmail: z.string().email(),
	passVerified: z.boolean().optional().default(false),
})

// ── POST /api/v1/live/create ──────────────────────────────────────
// Create a new live event (creator only)
app.post("/api/v1/live/create", async (c) => {
	let body: z.infer<typeof CreateEventBody>
	try {
		body = CreateEventBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body" }, 400)
	}

	const stub = getLiveStub(c.env, `event_${crypto.randomUUID()}`)
	const event = await stub.createEvent({
		creatorMailboxId: normalizeEmail(body.creatorMailboxId),
		title: body.title,
		description: body.description,
		scheduledAt: body.scheduledAt,
		passPrice: body.passPrice,
	})

	return c.json({ event }, 201)
})

// ── POST /api/v1/live/:eventId/start ──────────────────────────────
// Start a scheduled event + provision Stream Live Input
app.post("/api/v1/live/:eventId/start", async (c) => {
	const eventId = c.req.param("eventId")!
	const stub = getLiveStub(c.env, eventId)
	const result = await stub.startEvent(eventId)
	if ("error" in result) {
		return c.json(result, 400)
	}
	return c.json(result, 200)
})

// ── POST /api/v1/live/:eventId/end ────────────────────────────────
// End a live stream
app.post("/api/v1/live/:eventId/end", async (c) => {
	const eventId = c.req.param("eventId")!
	const stub = getLiveStub(c.env, eventId)
	const result = await stub.endEvent(eventId)
	if ("error" in result) {
		return c.json(result, 400)
	}
	return c.json(result, 200)
})

// ── GET /api/v1/live/:eventId ─────────────────────────────────────
// Get event details + viewer count
app.get("/api/v1/live/:eventId", async (c) => {
	const eventId = c.req.param("eventId")!
	const stub = getLiveStub(c.env, eventId)
	const event = await stub.getEvent(eventId)
	if (!event) {
		return c.json({ error: "Event not found" }, 404)
	}
	const viewerCount = await stub.getViewerCount(eventId)
	return c.json({ event, viewerCount }, 200)
})

// ── GET /api/v1/live/list/:creatorMailboxId ───────────────────────
// List events for a creator
app.get("/api/v1/live/list/:creatorMailboxId", async (c) => {
	const creatorMailboxId = normalizeEmail(c.req.param("creatorMailboxId")!)
	// Use the creator's mailbox ID as the DO namespace for listing
	const stub = getLiveStub(c.env, `creator_${creatorMailboxId}`)
	const events = await stub.listEvents(creatorMailboxId)
	return c.json({ events }, 200)
})

// ── GET /api/v1/live/schedule ─────────────────────────────────────
// Public upcoming + live events
app.get("/api/v1/live/schedule", async (c) => {
	// Use a singleton DO for schedule
	const stub = getLiveStub(c.env, "schedule")
	const events = await stub.scheduleEvents()
	return c.json({ events }, 200)
})

// ── POST /api/v1/live/:eventId/join ───────────────────────────────
// Join event (verify pass/subscription)
app.post("/api/v1/live/:eventId/join", async (c) => {
	const eventId = c.req.param("eventId")!

	let body: z.infer<typeof JoinBody>
	try {
		body = JoinBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body" }, 400)
	}

	const userEmail = normalizeEmail(body.userEmail)
	const stub = getLiveStub(c.env, eventId)

	const event = await stub.getEvent(eventId)
	if (!event) {
		return c.json({ error: "Event not found" }, 404)
	}

	// Check pass requirement
	let passVerified = body.passVerified
	if (event.passPrice > 0 && !passVerified) {
		// Try to verify via payment subscription
		try {
			const paymentStub = getPaymentStub(c.env, event.creatorMailboxId)
			const subscription = await paymentStub.getSubscription(event.creatorMailboxId)
			// If user has active subscription to the creator, consider pass verified
			if (subscription && subscription.status === "active") {
				passVerified = true
			}
		} catch {
			// Payment DO might not exist yet, that's fine
		}
	}

	// Free events: pass_price = 0 means no pass needed
	if (event.passPrice === 0) {
		passVerified = true
	}

	const result = await stub.joinEvent(eventId, userEmail, passVerified)
	if ("error" in result) {
		const code = "code" in result ? (result as { code: number }).code : 400
		return c.json({ error: result.error }, code as 200)
	}

	return c.json(result, 200)
})

// ── WebSocket upgrade route: GET /api/v1/live/:eventId/chat ──────
// This just proxies to the LiveDO's WebSocket upgrade handler
app.get("/api/v1/live/:eventId/chat", async (c) => {
	const eventId = c.req.param("eventId")!
	const stub = getLiveStub(c.env, eventId)

	const url = new URL(c.req.url)
	// Forward the query params for userEmail, displayName, token
	const doUrl = new URL(`https://live-do/${eventId}/chat${url.search}`)

	const doRequest = new Request(doUrl, {
		method: "GET",
		headers: {
			"Upgrade": "websocket",
			"Connection": "Upgrade",
		},
	})

	return stub.fetch(doRequest) as unknown as Response
})

// ── GET /api/v1/live/:eventId/viewers ─────────────────────────────
// Get viewer count for polling
app.get("/api/v1/live/:eventId/viewers", async (c) => {
	const eventId = c.req.param("eventId")!
	const stub = getLiveStub(c.env, eventId)
	const viewerCount = await stub.getViewerCount(eventId)
	return c.json({ viewerCount }, 200)
})

export { app }
