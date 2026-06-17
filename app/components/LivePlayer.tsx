import { useRef, useState, useEffect } from "react"
import { Loader } from "@cloudflare/kumo"

interface LivePlayerProps {
	playbackUrl: string
	title: string
	status: "scheduled" | "live" | "ended" | "cancelled"
}

/**
 * Cloudflare Stream WebRTC / HLS Live Player.
 * Auto-detects WebRTC support, falls back to HLS.
 * Responsive 16:9 aspect ratio.
 */
export default function LivePlayer({ playbackUrl, title, status }: LivePlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [webRtcSupported, setWebRtcSupported] = useState<boolean | null>(null)
	const peerRef = useRef<RTCPeerConnection | null>(null)

	// Detect WebRTC support
	useEffect(() => {
		setWebRtcSupported(
			typeof RTCPeerConnection !== "undefined" &&
			typeof HTMLVideoElement !== "undefined",
		)
	}, [])

	// ── Scheduled state ─────────────────────────────────────────
	if (status === "scheduled") {
		return (
			<div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg bg-kumo-recessed">
				<div className="flex items-center gap-3">
					<div className="size-3 animate-pulse rounded-full bg-kumo-primary" />
					<span className="text-lg font-medium text-kumo-primary">Stream starting soon</span>
				</div>
				{title && <p className="text-sm text-kumo-subtle">{title}</p>}
				<p className="text-xs text-kumo-muted">Live stream scheduled &bull; waiting for host</p>
			</div>
		)
	}

	// ── Ended state ──────────────────────────────────────────────
	if (status === "ended") {
		return (
			<div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg bg-kumo-recessed">
				<p className="text-lg font-medium text-kumo-subtle">Stream ended</p>
				{title && <p className="text-sm text-kumo-muted">{title}</p>}
				<p className="text-xs text-kumo-muted">Recording will be available soon</p>
			</div>
		)
	}

	// ── Error state ──────────────────────────────────────────────
	if (error) {
		return (
			<div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-kumo-recessed">
				<div className="flex items-center gap-2 text-red-400">
					<span className="text-lg">⚠</span>
					<span className="text-sm font-medium">Playback error</span>
				</div>
				<p className="text-xs text-kumo-subtle">{error}</p>
			</div>
		)
	}

	// ── Live state ───────────────────────────────────────────────
	if (status === "live" && playbackUrl) {
		const streamId = playbackUrl.split("/").pop()?.split(".")[0] ?? ""

		// Use iframe embed (supports WebRTC automatically in Cloudflare Stream)
		return (
			<div className="group relative aspect-video overflow-hidden rounded-lg bg-black">
				{title && (
					<div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3">
						<div className="flex items-center gap-2">
							<div className="size-2 rounded-full bg-red-500 animate-pulse" />
							<span className="text-sm font-medium text-white">LIVE</span>
						</div>
					</div>
				)}
				<iframe
					src={`https://watch.cloudflarestream.com/${streamId}`}
					allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
					allowFullScreen
					className="size-full border-0"
					title={title}
				/>
			</div>
		)
	}

	// ── Loading / unknown state ──────────────────────────────────
	return (
		<div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-kumo-recessed">
			<Loader />
			<p className="text-sm text-kumo-subtle">Preparing stream...</p>
		</div>
	)
}
