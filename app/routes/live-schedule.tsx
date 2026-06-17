import { Link } from "react-router"
import { Loader } from "@cloudflare/kumo"
import { Calendar, PlayCircle, Clock, CurrencyCircleDollar } from "@phosphor-icons/react"
import { useSchedule } from "~/queries/live"
import type { LiveEventData } from "~/services/live-api"

export default function LiveSchedulePage() {
	const { data, isLoading, isError } = useSchedule()

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader />
			</div>
		)
	}

	if (isError) {
		return (
			<div className="flex h-64 flex-col items-center justify-center gap-3">
				<p className="text-base text-kumo-subtle">Failed to load schedule</p>
				<p className="text-sm text-kumo-muted">Please try again later</p>
			</div>
		)
	}

	const events = data?.events ?? []
	const liveEvents = events.filter((e) => e.status === "live")
	const upcomingEvents = events.filter((e) => e.status === "scheduled")
	const pastEvents = events.filter((e) => e.status === "ended" || e.status === "cancelled")

	if (events.length === 0) {
		return (
			<div className="mx-auto max-w-4xl px-4 py-16">
				<div className="text-center">
					<Calendar className="mx-auto size-12 text-kumo-muted" />
					<h1 className="mt-6 text-2xl font-bold text-kumo-primary">Live Schedule</h1>
					<p className="mt-2 text-sm text-kumo-subtle">
						No live events scheduled yet. Check back soon!
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-8">
			<h1 className="mb-8 text-2xl font-bold text-kumo-primary">Live Schedule</h1>

			{/* Live now */}
			{liveEvents.length > 0 && (
				<section className="mb-10">
					<h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-500">
						<div className="size-2 rounded-full bg-red-500 animate-pulse" />
						Live now
					</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						{liveEvents.map((event) => (
							<EventCard key={event.id} event={event} isLive />
						))}
					</div>
				</section>
			)}

			{/* Upcoming */}
			{upcomingEvents.length > 0 && (
				<section className="mb-10">
					<h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-kumo-primary">
						<Clock className="size-5" />
						Upcoming
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.map((event) => (
							<EventCard key={event.id} event={event} />
						))}
					</div>
				</section>
			)}

			{/* Past events */}
			{pastEvents.length > 0 && (
				<section>
					<h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-kumo-subtle">
						<PlayCircle className="size-5" />
						Past events
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{pastEvents.map((event) => (
							<EventCard key={event.id} event={event} isPast />
						))}
					</div>
				</section>
			)}
		</div>
	)
}

function EventCard({
	event,
	isLive = false,
	isPast = false,
}: {
	event: LiveEventData
	isLive?: boolean
	isPast?: boolean
}) {
	const scheduledDate = event.scheduledAt
		? new Date(event.scheduledAt).toLocaleDateString("vi-VN", {
				weekday: "short",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null

	return (
		<Link
			to={`/live/${encodeURIComponent(event.id)}`}
			className={`block rounded-lg border p-5 transition-colors ${
				isLive
					? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
					: isPast
						? "border-kumo-border bg-kumo-recessed/50 hover:bg-kumo-recessed"
						: "border-kumo-border bg-kumo-base hover:bg-kumo-recessed"
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className={`truncate text-base font-semibold ${
						isPast ? "text-kumo-subtle" : "text-kumo-primary"
					}`}>
						{event.title}
					</h3>
					{event.description && (
						<p className="mt-1 line-clamp-2 text-sm text-kumo-subtle">
							{event.description}
						</p>
					)}
				</div>
				<span
					className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
						event.status === "live"
							? "bg-red-500/20 text-red-500"
							: event.status === "scheduled"
								? "bg-kumo-primary/20 text-kumo-primary"
								: event.status === "ended"
									? "bg-kumo-recessed text-kumo-subtle"
									: "bg-kumo-recessed text-kumo-muted"
					}`}
				>
					{event.status === "scheduled" ? "Upcoming" : event.status}
				</span>
			</div>

			<div className="mt-4 flex items-center gap-4 text-xs text-kumo-muted">
				{scheduledDate && (
					<span className="flex items-center gap-1">
						<Calendar className="size-3.5" />
						{scheduledDate}
					</span>
				)}
				{event.passPrice > 0 ? (
					<span className="flex items-center gap-1 text-kumo-primary">
						<CurrencyCircleDollar className="size-3.5" />
						{event.passPrice.toLocaleString()} VND
					</span>
				) : (
					<span className="flex items-center gap-1 text-green-500">
						<CurrencyCircleDollar className="size-3.5" />
						Free
					</span>
				)}
			</div>
		</Link>
	)
}
