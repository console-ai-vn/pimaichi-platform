import { Loader } from "@cloudflare/kumo";
import { useRef, useState } from "react";
import { useSignedStreamToken, useVideoStatus } from "~/queries/media";

interface VideoPlayerProps {
	videoId: string;
	signedToken?: string;
	title?: string;
	autoPlay?: boolean;
}

export default function VideoPlayer({
	videoId,
	signedToken,
	title,
	autoPlay = false,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);

	const { data: status } = useVideoStatus(videoId);
	const { data: tokenData } = useSignedStreamToken(
		signedToken ? undefined : videoId,
	);
	const resolvedToken = signedToken || tokenData?.token;

	const videoState = status?.state ?? "processing";

	const handleVideoError = () => {
		setError("Failed to load video. It may still be processing.");
	};

	if (videoState === "error") {
		return (
			<div className="flex aspect-video items-center justify-center rounded-lg bg-kumo-recessed">
				<p className="text-sm text-kumo-subtle">Video processing failed</p>
			</div>
		);
	}

	if (videoState !== "ready" || error) {
		return (
			<div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-kumo-recessed">
				<Loader />
				<p className="text-sm text-kumo-subtle">
					{error || "Video is processing..."}
				</p>
			</div>
		);
	}

	// Use HLS source with signed token for custom player
	if (status?.playback?.hls && resolvedToken) {
		const hlsUrl = `${status.playback.hls}?token=${encodeURIComponent(resolvedToken)}`;
		return (
			<div className="group relative aspect-video overflow-hidden rounded-lg bg-black">
				{title && (
					<div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
						<p className="text-sm font-medium text-white">{title}</p>
					</div>
				)}
				<video
					ref={videoRef}
					src={hlsUrl}
					preload="metadata"
					controls
					autoPlay={autoPlay}
					onError={handleVideoError}
					className="size-full"
				>
					<p>Your browser does not support the video element.</p>
				</video>
			</div>
		);
	}

	// Fallback: use Cloudflare Stream embed iframe
	if (status?.playback?.hls) {
		const streamUrl = `https://watch.cloudflarestream.com/${encodeURIComponent(videoId)}`;
		return (
			<div className="relative aspect-video overflow-hidden rounded-lg bg-black">
				{title && (
					<div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3">
						<p className="text-sm font-medium text-white">{title}</p>
					</div>
				)}
				<iframe
					src={streamUrl}
					allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
					allowFullScreen
					className="size-full border-0"
				/>
			</div>
		);
	}

	// Final fallback
	return (
		<div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-kumo-recessed">
			<p className="text-sm text-kumo-subtle">Video not available</p>
		</div>
	);
}
