import { Eye } from "@phosphor-icons/react"
import { useViewerCount } from "~/queries/live"

interface LiveViewerCountProps {
	eventId: string
}

/**
 * Displays connected viewer count for a live event.
 * Polled every 5 seconds via useViewerCount.
 */
export default function LiveViewerCount({ eventId }: LiveViewerCountProps) {
	const { data, isLoading } = useViewerCount(eventId)

	if (isLoading) {
		return (
			<div className="flex items-center gap-1.5">
				<Eye className="size-4 text-kumo-muted" weight="fill" />
				<span className="text-sm text-kumo-muted">--</span>
			</div>
		)
	}

	const count = data?.viewerCount ?? 0

	return (
		<div className="flex items-center gap-1.5">
			<Eye
				className={`size-4 ${count > 0 ? "text-kumo-primary" : "text-kumo-muted"}`}
				weight={count > 0 ? "fill" : "regular"}
			/>
			<span className={`text-sm font-medium ${count > 0 ? "text-kumo-primary" : "text-kumo-subtle"}`}>
				{count.toLocaleString()} {count === 1 ? "viewer" : "viewers"}
			</span>
		</div>
	)
}
