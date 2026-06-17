import { useState } from "react"
import { useParams } from "react-router"
import { Loader } from "@cloudflare/kumo"
import LivePlayer from "~/components/LivePlayer"
import LiveChat from "~/components/LiveChat"
import LiveViewerCount from "~/components/LiveViewerCount"
import { useLiveEvent, useJoinEvent } from "~/queries/live"
import type { LiveEventData } from "~/services/live-api"

export default function LivePage() {
	const { eventId } = useParams<{ eventId: string }>()
	const { data, isLoading, isError } = useLiveEvent(eventId)
	const joinMutation = useJoinEvent()

	const [joined, setJoined] = useState(false)
	const [joinData, setJoinData] = useState<{
		playbackUrl: string | null
		wsToken: string
	} | null>(null)
	const [userEmail, setUserEmail] = useState("")
	const [joinError, setJoinError] = useState<string | null>(null)

	const event: LiveEventData | undefined = data?.event
	const viewerCount = data?.viewerCount ?? 0

	const handleJoin = async () => {
		if (!eventId || !userEmail) return
		setJoinError(null)

		try {
			const result = await joinMutation.mutateAsync({
				eventId,
				payload: { userEmail, passVerified: false },
			})

			setJoinData({
				playbackUrl: result.playbackUrl,
				wsToken: result.wsToken,
			})
			setJoined(true)
		} catch (err) {
			setJoinError(
				err instanceof Error ? err.message : "Failed to join event",
			)
		}
	}

	if (isLoading) {
		return (
			<div className="flex h-96 items-center justify-center">
				<Loader />
			</div>
		)
	}

	if (isError || !event) {
		return (
			<div className="flex h-96 flex-col items-center justify-center gap-4">
				<p className="text-lg font-medium text-kumo-subtle">Event not found</p>
				<p className="text-sm text-kumo-muted">
					This live event may have ended or doesn't exist.
				</p>
			</div>
		)
	}

	// Join gate: user must enter email to join
	if (!joined) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16">
				{/* Event header */}
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-kumo-primary">{event.title}</h1>
					{event.description && (
						<p className="mt-2 text-sm text-kumo-subtle">{event.description}</p>
					)}
					<div className="mt-4 flex items-center gap-6 text-sm text-kumo-subtle">
						<span>Status: <span className="font-medium capitalize">{event.status}</span></span>
						<span>{viewerCount} watching</span>
						{event.passPrice > 0 && (
							<span className="text-kumo-primary font-medium">
								Pass: {event.passPrice.toLocaleString()} VND
							</span>
						)}
						{event.passPrice === 0 && (
							<span className="text-green-500 font-medium">Free</span>
						)}
					</div>
				</div>

				{/* Join form */}
				<div className="rounded-lg border border-kumo-border bg-kumo-base p-6">
					<h2 className="mb-4 text-lg font-semibold text-kumo-primary">
						Join the stream
					</h2>

					{joinError && (
						<div className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-500">
							{joinError}
						</div>
					)}

					<div className="flex gap-3">
						<input
							type="email"
							value={userEmail}
							onChange={(e) => setUserEmail(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleJoin()}
							placeholder="Enter your email to join"
							className="flex-1 rounded-md border border-kumo-border bg-kumo-recessed px-4 py-2 text-sm text-kumo-primary placeholder:text-kumo-muted focus:border-kumo-primary focus:outline-none"
						/>
						<button
							onClick={handleJoin}
							disabled={!userEmail || joinMutation.isPending}
							className="rounded-md bg-kumo-primary px-6 py-2 text-sm font-medium text-white hover:bg-kumo-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{joinMutation.isPending ? "Joining..." : "Join"}
						</button>
					</div>

					{event.passPrice > 0 && (
						<p className="mt-3 text-xs text-kumo-muted">
							This event requires a pass ({event.passPrice.toLocaleString()} VND) or an active subscription.
						</p>
					)}
				</div>
			</div>
		)
	}

	// ── Joined: show stream + chat ──────────────────────────────────
	return (
		<div className="flex h-[calc(100vh-64px)]">
			{/* Main content area */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Video player */}
				<div className="p-4">
					<LivePlayer
						playbackUrl={joinData?.playbackUrl ?? ""}
						title={event.title}
						status={event.status}
					/>
				</div>

				{/* Event info bar */}
				<div className="flex items-center justify-between border-t border-kumo-border px-6 py-3">
					<div>
						<h2 className="text-base font-semibold text-kumo-primary">
							{event.title}
						</h2>
						<p className="text-xs text-kumo-subtle">
							{event.description}
						</p>
					</div>
					<div className="flex items-center gap-4">
						<LiveViewerCount eventId={eventId!} />
						<span className="flex items-center gap-1.5 text-sm text-kumo-subtle capitalize">
							<div className={`size-2 rounded-full ${
								event.status === "live" ? "bg-red-500 animate-pulse" : "bg-kumo-muted"
							}`} />
							{event.status}
						</span>
					</div>
				</div>
			</div>

			{/* Chat sidebar */}
			<div className="w-80 border-l border-kumo-border">
				<LiveChat
					eventId={eventId!}
					userEmail={userEmail}
					displayName={userEmail.split("@")[0]}
					wsToken={joinData!.wsToken}
				/>
			</div>
		</div>
	)
}
