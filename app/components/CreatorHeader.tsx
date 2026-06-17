import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@cloudflare/kumo"
import {
	Users,
	Article,
	Package,
	UserCircle,
	CaretDown,
	CaretUp,
} from "@phosphor-icons/react"
import { cfFullUrl } from "~/lib/cf-images"

interface CreatorHeaderData {
	name: string
	handle?: string | null
	bio?: string | null
	avatarUrl?: string | null
	avatarImageId?: string | null
	coverUrl?: string | null
	coverImageId?: string | null
	subscriberCount: number
	postCount: number
	itemCount: number
}

interface CreatorHeaderProps {
	creator: CreatorHeaderData
	isSubscribed: boolean
	onSubscribe?: () => void
}

/**
 * Sticky creator profile header with parallax cover, avatar overlap,
 * collapsible bio, subscribe CTA, and stats row.
 */
export default function CreatorHeader({
	creator,
	isSubscribed,
	onSubscribe,
}: CreatorHeaderProps) {
	const [bioExpanded, setBioExpanded] = useState(false)
	const [scrollY, setScrollY] = useState(0)
	const headerRef = useRef<HTMLDivElement>(null)

	// Parallax on scroll
	useEffect(() => {
		const onScroll = () => {
			setScrollY(window.scrollY)
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
	}, [])

	const coverSrc = cfFullUrl(creator.coverImageId) || creator.coverUrl
	const avatarSrc = cfFullUrl(creator.avatarImageId) || creator.avatarUrl
	const parallaxOffset = Math.min(scrollY * 0.3, 100)
	const bioLines = 2
	const showBioExpand = (creator.bio?.length ?? 0) > 120

	return (
		<div ref={headerRef} className="sticky top-0 z-30 -mt-1">
			{/* Cover image with parallax */}
			<div className="relative h-40 overflow-hidden sm:h-48 md:h-56">
				{coverSrc ? (
					<img
						src={coverSrc}
						alt=""
						className="absolute inset-0 h-full w-full object-cover"
						style={{ transform: `translateY(${parallaxOffset}px)` }}
					/>
				) : (
					<div className="h-full w-full bg-gradient-to-r from-kumo-brand/60 to-purple-500/40" />
				)}
				{/* Gradient overlay */}
				<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
			</div>

			{/* Avatar + Info */}
			<div className="relative -mt-12 bg-kumo-base px-4 pb-3 sm:-mt-16 sm:px-6">
				<div className="flex items-end gap-3 sm:gap-4">
					{/* Avatar */}
					<div className="relative shrink-0">
						<div className="h-20 w-20 overflow-hidden rounded-full border-4 border-kumo-base bg-kumo-fill ring-2 ring-white/10 sm:h-24 sm:w-24">
							{avatarSrc ? (
								<img
									src={avatarSrc}
									alt={creator.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-2xl font-bold text-kumo-subtle">
									{creator.name[0]?.toUpperCase() || <UserCircle size={32} className="text-kumo-inactive" />}
								</div>
							)}
						</div>
					</div>

					{/* Name + Subscribe */}
					<div className="flex flex-1 items-end justify-between pb-2">
						<div>
							<h1 className="text-xl font-bold text-kumo-default sm:text-2xl">
								{creator.name}
							</h1>
							{creator.handle && (
								<p className="text-sm text-kumo-subtle">@{creator.handle}</p>
							)}
						</div>

						{onSubscribe && !isSubscribed && (
							<Button
								variant="primary"
								size="sm"
								onClick={onSubscribe}
								className="hidden animate-pulse sm:inline-flex"
							>
								Subscribe
							</Button>
						)}
					</div>
				</div>

				{/* Mobile subscribe */}
				{onSubscribe && !isSubscribed && (
					<div className="mt-3 sm:hidden">
						<Button
							variant="primary"
							size="sm"
							onClick={onSubscribe}
							className="w-full animate-pulse"
						>
							Subscribe
						</Button>
					</div>
				)}

				{/* Bio */}
				{creator.bio && (
					<div className="mt-2">
						<p
							className={`text-sm text-kumo-subtle ${
								!bioExpanded ? "line-clamp-2" : ""
							}`}
						>
							{creator.bio.replace(/<[^>]*>/g, "")}
						</p>
						{showBioExpand && (
							<button
								type="button"
								onClick={() => setBioExpanded(!bioExpanded)}
								className="mt-1 flex items-center gap-1 text-xs text-kumo-brand"
							>
								{bioExpanded ? "Show less" : "Show more"}
								{bioExpanded ? (
									<CaretUp size={12} />
								) : (
									<CaretDown size={12} />
								)}
							</button>
						)}
					</div>
				)}

				{/* Stats row */}
				<div className="mt-3 flex flex-wrap items-center gap-4 border-t border-kumo-line pt-3">
					<StatItem
						icon={Article}
						count={creator.postCount}
						label="Posts"
					/>
					<StatItem
						icon={Users}
						count={creator.subscriberCount}
						label="Subscribers"
					/>
					<StatItem
						icon={Package}
						count={creator.itemCount}
						label="Items"
					/>
				</div>

				{/* Subscribed badge */}
				{isSubscribed && (
					<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
						Subscribed
					</div>
				)}
			</div>
		</div>
	)
}

function StatItem({
	icon: Icon,
	count,
	label,
}: {
	icon: React.ElementType
	count: number
	label: string
}) {
	return (
		<div className="flex items-center gap-1.5 text-kumo-subtle">
			<Icon size={14} className="text-kumo-inactive" />
			<span className="text-sm font-semibold text-kumo-default">
				{count.toLocaleString()}
			</span>
			<span className="text-xs">{label}</span>
		</div>
	)
}
