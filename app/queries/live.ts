import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
	liveApi,
	type CreateEventPayload,
	type JoinEventPayload,
} from "~/services/live-api"

// ── Query Keys ────────────────────────────────────────────────────

export const liveKeys = {
	all: ["live"] as const,
	event: (eventId: string) => ["live", "event", eventId] as const,
	list: (mailboxId: string) => ["live", "list", mailboxId] as const,
	schedule: () => ["live", "schedule"] as const,
	viewerCount: (eventId: string) => ["live", "viewers", eventId] as const,
}

// ── Queries ───────────────────────────────────────────────────────

export function useLiveEvent(eventId: string | undefined) {
	return useQuery({
		queryKey: eventId ? liveKeys.event(eventId) : ["live", "event", "_disabled"],
		queryFn: () => liveApi.getEvent(eventId!),
		enabled: !!eventId,
		refetchInterval: 10_000, // poll every 10s for status changes
	})
}

export function useLiveEvents(creatorMailboxId: string | undefined) {
	return useQuery({
		queryKey: creatorMailboxId
			? liveKeys.list(creatorMailboxId)
			: ["live", "list", "_disabled"],
		queryFn: () => liveApi.listEvents(creatorMailboxId!),
		enabled: !!creatorMailboxId,
	})
}

export function useSchedule() {
	return useQuery({
		queryKey: liveKeys.schedule(),
		queryFn: () => liveApi.schedule(),
		refetchInterval: 30_000,
	})
}

export function useViewerCount(eventId: string | undefined) {
	return useQuery({
		queryKey: eventId
			? liveKeys.viewerCount(eventId)
			: ["live", "viewers", "_disabled"],
		queryFn: () => liveApi.getViewerCount(eventId!),
		enabled: !!eventId,
		refetchInterval: 5000,
	})
}

// ── Mutations ─────────────────────────────────────────────────────

export function useCreateEvent() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (payload: CreateEventPayload) => liveApi.createEvent(payload),
		onSuccess: (_data, variables) => {
			qc.invalidateQueries({ queryKey: liveKeys.list(variables.creatorMailboxId) })
			qc.invalidateQueries({ queryKey: liveKeys.schedule() })
		},
	})
}

export function useStartEvent() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (eventId: string) => liveApi.startEvent(eventId),
		onSuccess: (_data, eventId) => {
			qc.invalidateQueries({ queryKey: liveKeys.event(eventId) })
			qc.invalidateQueries({ queryKey: liveKeys.schedule() })
		},
	})
}

export function useEndEvent() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (eventId: string) => liveApi.endEvent(eventId),
		onSuccess: (_data, eventId) => {
			qc.invalidateQueries({ queryKey: liveKeys.event(eventId) })
			qc.invalidateQueries({ queryKey: liveKeys.schedule() })
		},
	})
}

export function useJoinEvent() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: ({
			eventId,
			payload,
		}: {
			eventId: string
			payload: JoinEventPayload
		}) => liveApi.joinEvent(eventId, payload),
		onSuccess: (_data, { eventId }) => {
			qc.invalidateQueries({ queryKey: liveKeys.event(eventId) })
		},
	})
}
