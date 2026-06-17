const REQUEST_TIMEOUT_MS = 30_000

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal

	try {
		const res = await fetch(url, {
			...options,
			signal,
			headers: {
				"Content-Type": "application/json",
				...(options.headers as Record<string, string>),
			},
		})

		if (!res.ok) {
			const body = await res.json().catch(() => ({}))
			throw new ApiError(res.status, body as Record<string, unknown>)
		}

		if (res.status === 204) return undefined as T
		return res.json() as Promise<T>
	} finally {
		clearTimeout(timeout)
	}
}

export class ApiError extends Error {
	status: number
	body: Record<string, unknown>
	constructor(status: number, body: Record<string, unknown>) {
		super((body.error as string) || `Request failed: ${status}`)
		this.name = "ApiError"
		this.status = status
		this.body = body
	}
}

export interface LiveEventData {
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

export interface CreateEventPayload {
	creatorMailboxId: string
	title: string
	description?: string
	scheduledAt?: string
	passPrice?: number
}

export interface JoinEventPayload {
	userEmail: string
	passVerified?: boolean
}

export const liveApi = {
	createEvent: (payload: CreateEventPayload) =>
		request<{ event: LiveEventData }>("/api/v1/live/create", {
			method: "POST",
			body: JSON.stringify(payload),
		}),

	startEvent: (eventId: string) =>
		request<{ rtmpsUrl: string; playbackUrl: string }>(
			`/api/v1/live/${encodeURIComponent(eventId)}/start`,
			{ method: "POST" },
		),

	endEvent: (eventId: string) =>
		request<LiveEventData>(
			`/api/v1/live/${encodeURIComponent(eventId)}/end`,
			{ method: "POST" },
		),

	getEvent: (eventId: string) =>
		request<{ event: LiveEventData; viewerCount: number }>(
			`/api/v1/live/${encodeURIComponent(eventId)}`,
		),

	listEvents: (creatorMailboxId: string) =>
		request<{ events: LiveEventData[] }>(
			`/api/v1/live/list/${encodeURIComponent(creatorMailboxId)}`,
		),

	schedule: () => request<{ events: LiveEventData[] }>("/api/v1/live/schedule"),

	joinEvent: (eventId: string, payload: JoinEventPayload) =>
		request<{
			playbackUrl: string | null
			wsToken: string
			event: LiveEventData
		}>(`/api/v1/live/${encodeURIComponent(eventId)}/join`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),

	getViewerCount: (eventId: string) =>
		request<{ viewerCount: number }>(
			`/api/v1/live/${encodeURIComponent(eventId)}/viewers`,
		),
}
