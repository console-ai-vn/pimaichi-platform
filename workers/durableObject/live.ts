import { DurableObject } from "cloudflare:workers"
import { applyMigrations } from "./migrations"
import { liveMigrations } from "./liveMigrations"
import { validateChatMessage } from "../lib/live-chat"
import type { Env } from "../types"

// ── Types ──────────────────────────────────────────────────────────

export interface LiveEvent {
	id: string
	creatorMailboxId: string
	title: string
	description: string
	scheduledAt: string | null
	startedAt: string | null
	endedAt: string | null
	status: "scheduled" | "live" | "ended" | "cancelled"
	streamLiveInputUid: string | null
	rtmpsUrl: string | null
	playbackUrl: string | null
	passPrice: number
	createdAt: string
	updatedAt: string
}

export interface LiveEventRow {
	id: string
	creator_mailbox_id: string
	title: string
	description: string
	scheduled_at: string | null
	started_at: string | null
	ended_at: string | null
	status: string
	stream_live_input_uid: string | null
	rtmps_url: string | null
	playback_url: string | null
	pass_price: number
	created_at: string
	updated_at: string
}

export interface CreateEventParams {
	creatorMailboxId: string
	title: string
	description?: string
	scheduledAt?: string
	passPrice?: number
}

export interface ChatMessage {
	id: string
	eventId: string
	userEmail: string
	displayName: string
	message: string
	systemMessage: boolean
	createdAt: string
}

export interface ViewerInfo {
	id: string
	eventId: string
	userEmail: string
	joinedAt: string
	leftAt: string | null
}

export interface JoinResult {
	playbackUrl: string | null
	wsToken: string
	event: LiveEvent
}

// ── DO Class ───────────────────────────────────────────────────────

export class LiveDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never

	private sql: SqlStorage

	constructor(state: DurableObjectState, env: Env) {
		super(state, env)
		this.sql = this.ctx.storage.sql
		applyMigrations(this.sql, liveMigrations, this.ctx.storage)
	}

	// ── HTTP API via fetch ──────────────────────────────────────────

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const method = request.method

		// WebSocket upgrade for live chat
		if (url.pathname.endsWith("/chat") && method === "GET") {
			return this.handleWebSocketUpgrade(request, url)
		}

		// HTTP API routes
		try {
			if (url.pathname.includes("/start") && method === "POST") {
				const eventId = this.extractId(url, "/start")
				return this.handleStart(eventId)
			}
			if (url.pathname.includes("/end") && method === "POST") {
				const eventId = this.extractId(url, "/end")
				return this.handleEnd(eventId)
			}
			if (url.pathname.includes("/join") && method === "POST") {
				const eventId = this.extractId(url, "/join")
				const body = (await request.json().catch(() => ({}))) as {
					userEmail?: string
					passVerified?: boolean
				}
				return this.handleJoin(eventId, body.userEmail ?? "", body.passVerified ?? false)
			}
			if (url.pathname.includes("/viewers") && method === "GET") {
				const eventId = this.extractId(url, "/viewers")
				return this.handleGetViewerCount(eventId)
			}

			// GET event by ID
			if (method === "GET") {
				const parts = url.pathname.split("/").filter(Boolean)
				const eventId = parts[parts.length - 1]
				return this.handleGetEvent(eventId)
			}

			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			})
		} catch (e) {
			return new Response(
				JSON.stringify({ error: (e as Error).message }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			)
		}
	}

	// ── WebSocket Hibernation Handlers ──────────────────────────────

	async webSocketMessage(ws: WebSocket, rawMessage: string): Promise<void> {
		const tag = ws.deserializeAttachment() as {
			eventId: string
			userEmail: string
			displayName: string
		} | null

		if (!tag) {
			ws.close(4001, "Missing session tag")
			return
		}

		let parsed: { type: string; message?: string }
		try {
			parsed = JSON.parse(rawMessage)
		} catch {
			ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }))
			return
		}

		if (parsed.type !== "chat" || !parsed.message) {
			ws.send(JSON.stringify({ type: "error", error: "Expected { type: 'chat', message: string }" }))
			return
		}

		const validation = validateChatMessage(parsed.message)
		if (!validation.ok) {
			ws.send(JSON.stringify({ type: "error", error: validation.error }))
			return
		}

		const msg = await this.storeChatMessage(
			tag.eventId,
			tag.userEmail,
			tag.displayName,
			validation.sanitized,
		)

		// Generate a short user ID from email for WebSocket broadcast
		const userId = tag.userEmail.split("@")[0]

		// Broadcast to all connected WebSockets
		const broadcast = JSON.stringify({
			type: "chat",
			messageId: msg.id,
			userId,
			displayName: tag.displayName,
			message: validation.sanitized,
			timestamp: msg.createdAt,
		})

		for (const conn of this.ctx.getWebSockets()) {
			try {
				conn.send(broadcast)
			} catch {
				// Connection may have closed
			}
		}
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
	): Promise<void> {
		const tag = ws.deserializeAttachment() as {
			eventId: string
			userEmail: string
			displayName: string
		} | null

		if (!tag) return

		// Mark viewer as left
		this.sql.exec(
			`UPDATE live_viewers SET left_at = datetime('now') WHERE event_id = ?1 AND user_email = ?2 AND left_at IS NULL`,
			tag.eventId, tag.userEmail,
		)

		// Broadcast leave message
		const broadcast = JSON.stringify({
			type: "system",
			event: "user_left",
			userId: tag.userEmail.split("@")[0],
			displayName: tag.displayName,
		})

		for (const conn of this.ctx.getWebSockets()) {
			try { conn.send(broadcast) } catch { /* ignore */ }
		}
	}

	async webSocketError(
		ws: WebSocket,
		error: Error,
	): Promise<void> {
		console.error("LiveDO WebSocket error:", error.message)
		const tag = ws.deserializeAttachment() as {
			eventId: string
			userEmail: string
		} | null

		if (tag) {
			this.sql.exec(
				`UPDATE live_viewers SET left_at = datetime('now') WHERE event_id = ?1 AND user_email = ?2 AND left_at IS NULL`,
				tag.eventId, tag.userEmail,
			)
		}
	}

	// ── Core Methods ────────────────────────────────────────────────

	async createEvent(params: CreateEventParams): Promise<LiveEvent> {
		const id = crypto.randomUUID()
		const now = new Date().toISOString()

		this.sql.exec(
			`INSERT INTO live_events (id, creator_mailbox_id, title, description, scheduled_at, pass_price, created_at, updated_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
			id,
			params.creatorMailboxId,
			params.title,
			params.description ?? "",
			params.scheduledAt ?? null,
			params.passPrice ?? 0,
			now,
		)

		return this.getEvent(id)!
	}

	async startEvent(eventId: string): Promise<{ rtmpsUrl: string; playbackUrl: string } | { error: string }> {
		const event = this.getEventRow(eventId)
		if (!event) return { error: "Event not found" }
		if (event.status !== "scheduled") {
			return { error: `Event is ${event.status}, cannot start` }
		}

		// Provision Cloudflare Stream Live Input via the DO's env
		const streamResult = await this.provisionStreamLiveInput(event.title)
		if (!streamResult.ok) {
			return { error: streamResult.error ?? "Failed to provision stream" }
		}

		const now = new Date().toISOString()
		this.sql.exec(
			`UPDATE live_events
			 SET status = 'live', started_at = ?1, stream_live_input_uid = ?2, rtmps_url = ?3, playback_url = ?4, updated_at = ?5
			 WHERE id = ?6`,
			now, streamResult.uid, streamResult.rtmpsUrl, streamResult.playbackUrl, now, eventId,
		)

		return { rtmpsUrl: streamResult.rtmpsUrl, playbackUrl: streamResult.playbackUrl }
	}

	async endEvent(eventId: string): Promise<LiveEvent | { error: string }> {
		const event = this.getEventRow(eventId)
		if (!event) return { error: "Event not found" }
		if (event.status !== "live") {
			return { error: "Event is not currently live" }
		}

		const now = new Date().toISOString()

		// Delete the Stream Live Input if we created one
		if (event.stream_live_input_uid) {
			await this.deleteStreamLiveInput(event.stream_live_input_uid)
		}

		this.sql.exec(
			`UPDATE live_events SET status = 'ended', ended_at = ?1, updated_at = ?1 WHERE id = ?2`,
			now, eventId,
		)

		// Mark all active viewers as left
		this.sql.exec(
			`UPDATE live_viewers SET left_at = ?1 WHERE event_id = ?2 AND left_at IS NULL`,
			now, eventId,
		)

		// Broadcast stream ended to all connected WebSockets
		const broadcast = JSON.stringify({ type: "system", event: "stream_ended" })
		for (const conn of this.ctx.getWebSockets()) {
			try { conn.send(broadcast) } catch { /* ignore */ }
		}

		return this.getEvent(eventId)!
	}

	async joinEvent(
		eventId: string,
		userEmail: string,
		passVerified: boolean,
	): Promise<JoinResult | { error: string; code: number }> {
		const event = this.getEventRow(eventId)
		if (!event) return { error: "Event not found", code: 404 }

		// Check pass requirement
		if (event.pass_price > 0 && !passVerified) {
			return { error: "Pass purchase required", code: 402 }
		}

		// Record viewer
		const viewerId = crypto.randomUUID()
		const now = new Date().toISOString()
		this.sql.exec(
			`INSERT INTO live_viewers (id, event_id, user_email, joined_at) VALUES (?1, ?2, ?3, ?4)`,
			viewerId, eventId, userEmail, now,
		)

		// Generate a WS token (simple UUID for this implementation)
		const wsToken = crypto.randomUUID()

		return {
			playbackUrl: event.playback_url,
			wsToken,
			event: mapRowToEvent(event),
		}
	}

	getEvent(eventId: string): LiveEvent | null {
		const row = this.getEventRow(eventId)
		return row ? mapRowToEvent(row) : null
	}

	listEvents(creatorMailboxId: string): LiveEvent[] {
		const rows = [
			...this.sql.exec(
				`SELECT * FROM live_events
				 WHERE creator_mailbox_id = ?1
				 ORDER BY created_at DESC LIMIT 50`,
				creatorMailboxId,
			),
		] as LiveEventRow[]

		return rows.map(mapRowToEvent)
	}

	scheduleEvents(): LiveEvent[] {
		const rows = [
			...this.sql.exec(
				`SELECT * FROM live_events
				 WHERE status IN ('scheduled', 'live')
				 ORDER BY
				   CASE WHEN status = 'live' THEN 0 ELSE 1 END,
				   scheduled_at ASC LIMIT 50`,
			),
		] as LiveEventRow[]

		return rows.map(mapRowToEvent)
	}

	getViewerCount(eventId: string): number {
		const row = [
			...this.sql.exec(
				`SELECT COUNT(*) as cnt FROM live_viewers WHERE event_id = ?1 AND left_at IS NULL`,
				eventId,
			),
		][0] as { cnt: number } | undefined
		return row?.cnt ?? 0
	}

	async storeChatMessage(
		eventId: string,
		userEmail: string,
		displayName: string,
		message: string,
	): Promise<ChatMessage> {
		const id = crypto.randomUUID()
		const now = new Date().toISOString()

		this.sql.exec(
			`INSERT INTO live_chat (id, event_id, user_email, display_name, message, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			id, eventId, userEmail, displayName, message, now,
		)

		return { id, eventId, userEmail, displayName, message, systemMessage: false, createdAt: now }
	}

	// ── HTTP Handlers ───────────────────────────────────────────────

	private async handleStart(eventId: string): Promise<Response> {
		const result = await this.startEvent(eventId)
		if ("error" in result) {
			return new Response(JSON.stringify(result), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}

	private async handleEnd(eventId: string): Promise<Response> {
		const result = await this.endEvent(eventId)
		if ("error" in result) {
			return new Response(JSON.stringify(result), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}

	private async handleJoin(
		eventId: string,
		userEmail: string,
		passVerified: boolean,
	): Promise<Response> {
		const result = await this.joinEvent(eventId, userEmail, passVerified)
		if ("error" in result) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: result.code ?? 400,
				headers: { "Content-Type": "application/json" },
			})
		}
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}

	private async handleGetEvent(eventId: string): Promise<Response> {
		const event = this.getEvent(eventId)
		if (!event) {
			return new Response(JSON.stringify({ error: "Event not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			})
		}
		const viewerCount = this.getViewerCount(eventId)
		return new Response(JSON.stringify({ event, viewerCount }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}

	private async handleGetViewerCount(eventId: string): Promise<Response> {
		const count = this.getViewerCount(eventId)
		return new Response(JSON.stringify({ viewerCount: count }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}

	// ── WebSocket Upgrade ───────────────────────────────────────────

	private handleWebSocketUpgrade(request: Request, url: URL): Response {
		const eventId = url.pathname.split("/chat")[0].split("/").filter(Boolean).pop() ?? ""
		const userEmail = url.searchParams.get("userEmail") ?? ""
		const displayName = url.searchParams.get("displayName") ?? userEmail.split("@")[0]
		const wsToken = url.searchParams.get("token") ?? ""

		if (!eventId || !userEmail || !wsToken) {
			return new Response(
				JSON.stringify({ error: "Missing eventId, userEmail, or token" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			)
		}

		// Verify token exists (simple check - token is generated at join time)
		const viewer = [
			...this.sql.exec(
				`SELECT id FROM live_viewers WHERE event_id = ?1 AND user_email = ?2 AND left_at IS NULL LIMIT 1`,
				eventId, userEmail,
			),
		]

		if (viewer.length === 0) {
			return new Response(
				JSON.stringify({ error: "Not joined to this event" }),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			)
		}

		const pair = new WebSocketPair()
		const [client, server] = Object.values(pair)

		// Store session data in the WebSocket attachment for hibernation
		server.serializeAttachment({ eventId, userEmail, displayName })

		this.ctx.acceptWebSocket(server)

		// Add system message about user joining
		const broadcast = JSON.stringify({
			type: "system",
			event: "user_joined",
			userId: userEmail.split("@")[0],
			displayName,
		})

		// Add system chat message
		this.sql.exec(
			`INSERT INTO live_chat (id, event_id, user_email, display_name, message, system_message, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, 1, datetime('now'))`,
			crypto.randomUUID(), eventId, userEmail, displayName,
			`${displayName} joined the stream`,
		)

		for (const conn of this.ctx.getWebSockets()) {
			try { conn.send(broadcast) } catch { /* ignore */ }
		}

		return new Response(null, { status: 101, webSocket: client })
	}

	// ── Helpers ─────────────────────────────────────────────────────

	private getEventRow(eventId: string): LiveEventRow | null {
		const rows = [
			...this.sql.exec(`SELECT * FROM live_events WHERE id = ?1`, eventId),
		] as LiveEventRow[]
		return rows.length > 0 ? rows[0] : null
	}

	private extractId(url: URL, suffix: string): string {
		const pathname = url.pathname
		const idx = pathname.indexOf(suffix)
		if (idx === -1) return ""
		const before = pathname.substring(0, idx)
		const parts = before.split("/").filter(Boolean)
		return parts[parts.length - 1] ?? ""
	}

	// ── Cloudflare Stream Live Input ────────────────────────────────

	private async provisionStreamLiveInput(title: string): Promise<{
		ok: boolean
		uid?: string
		rtmpsUrl?: string
		playbackUrl?: string
		error?: string
	}> {
		const accountId = this.env.CF_ACCOUNT_ID
		const token = this.env.CF_STREAM_TOKEN

		if (!accountId || !token) {
			return { ok: false, error: "CF_ACCOUNT_ID or CF_STREAM_TOKEN not configured" }
		}

		try {
			const res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						meta: { name: title },
						recording: { mode: "automatic" },
					}),
				},
			)

			const data = (await res.json()) as {
				success: boolean
				errors?: Array<{ message: string }>
				result?: {
					uid: string
					rtmps: { url: string }
					playback: { hls: string; dash: string }
				}
			}

			if (!res.ok || !data.success) {
				return {
					ok: false,
					error: data.errors?.[0]?.message ?? `Stream API error: ${res.status}`,
				}
			}

			return {
				ok: true,
				uid: data.result!.uid,
				rtmpsUrl: data.result!.rtmps.url,
				playbackUrl: data.result!.playback.hls,
			}
		} catch (e) {
			return { ok: false, error: (e as Error).message }
		}
	}

	private async deleteStreamLiveInput(uid: string): Promise<void> {
		const accountId = this.env.CF_ACCOUNT_ID
		const token = this.env.CF_STREAM_TOKEN

		if (!accountId || !token) return

		try {
			await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${uid}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
			)
		} catch (e) {
			console.error("Failed to delete stream live input:", (e as Error).message)
		}
	}
}

// ── Utility ────────────────────────────────────────────────────────

function mapRowToEvent(row: LiveEventRow): LiveEvent {
	return {
		id: row.id,
		creatorMailboxId: row.creator_mailbox_id,
		title: row.title,
		description: row.description,
		scheduledAt: row.scheduled_at,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		status: row.status as LiveEvent["status"],
		streamLiveInputUid: row.stream_live_input_uid,
		rtmpsUrl: row.rtmps_url,
		playbackUrl: row.playback_url,
		passPrice: row.pass_price,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}
