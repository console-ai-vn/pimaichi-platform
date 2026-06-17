import { LockKey, UserCircle } from "@phosphor-icons/react"
import { cfThumbUrl, cfBlurUrl } from "~/lib/cf-images"

interface FeedCardCreator {
	name: string
	avatarUrl?: string | null
}

interface FeedCardProps {
	creator: FeedCardCreator
	thumbnail?: string | null
	imageId?: string | null
	title: string
	tier: "public" | "subscribers" | "ppv"
	subscriberCount: number
	isNew: boolean
	onClick?: () => void
}

/**
 * Feed card with creator avatar overlay, lock badge, and subscriber count.
 * OnlyFans-style: 3:4 aspect, creator avatar top-left, lock icon top-right.
 * Image via CF Images CDN with native lazy loading.
 */
export default function FeedCard({
	creator,
	thumbnail,
	imageId,
	title,
	tier,
	subscriberCount,
	isNew,
	onClick,
}: FeedCardProps) {
	const imgSrc = cfThumbUrl(imageId) || thumbnail || ""
	const blurSrc = cfBlurUrl(imageId)

	const tierRingColor =
		tier === "subscribers"
			? "ring-blue-500"
			: tier === "ppv"
				? "ring-amber-500"
				: "ring-emerald-500"

	return (
		<button
			type="button"
			onClick={onClick}
			className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-fill text-left transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-kumo-brand"
		>
			{/* Image area — 3:4 aspect */}
			<div className="relative aspect-[3/4] w-full overflow-hidden bg-kumo-fill">
				{imgSrc ? (
					<>
						{/* Blur placeholder (tiny image loaded first) */}
						{blurSrc && (
							<img
								src={blurSrc}
								alt=""
								className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
								aria-hidden="true"
							/>
						)}
						<img
							src={imgSrc}
							alt={title}
							loading="lazy"
							decoding="async"
							className="relative z-10 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
						/>
					</>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-kumo-fill to-kumo-recessed">
						<UserCircle
							size={48}
							className="text-kumo-inactive"
							weight="duotone"
						/>
					</div>
				)}

				{/* Creator avatar — top-left overlay */}
				<div className="absolute left-2 top-2 z-20">
					<div className={`rounded-full ring-2 ring-white/20 ${tierRingColor}`}>
						{creator.avatarUrl ? (
							<img
								src={creator.avatarUrl}
								alt={creator.name}
								className="h-8 w-8 rounded-full object-cover"
								loading="lazy"
							/>
						) : (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-kumo-fill">
								<UserCircle
									size={20}
									className="text-kumo-subtle"
									weight="fill"
								/>
							</div>
						)}
					</div>
				</div>

				{/* Lock badge — top-right if gated */}
				{tier !== "public" && (
					<div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur">
						<LockKey size={12} className="text-white" weight="fill" />
						<span className="text-[10px] font-medium text-white">
							{tier === "subscribers" ? "SUB" : "PPV"}
						</span>
					</div>
				)}

				{/* "New" badge */}
				{isNew && (
					<div className="absolute bottom-2 left-2 z-20 animate-pulse rounded-full bg-kumo-brand px-2 py-0.5 text-[10px] font-bold text-white">
						NEW
					</div>
				)}

				{/* Gradient overlay at bottom for text readability */}
				<div className="absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/60 to-transparent" />
			</div>

			{/* Info section */}
			<div className="flex flex-col gap-0.5 p-2">
				<p className="truncate text-xs font-medium text-kumo-default">
					{creator.name}
				</p>
				<div className="flex items-center gap-1.5">
					<p className="truncate text-[11px] text-kumo-subtle">{title}</p>
					{subscriberCount > 0 && (
						<span className="shrink-0 text-[10px] text-kumo-inactive">
							{subscriberCount >= 1000
								? `${(subscriberCount / 1000).toFixed(1)}k`
								: subscriberCount}
						</span>
					)}
				</div>
			</div>
		</button>
	)
}
