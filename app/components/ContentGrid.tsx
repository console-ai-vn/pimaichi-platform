import { Button } from "@cloudflare/kumo"
import { ImageIcon } from "@phosphor-icons/react"
import GateOverlay from "~/components/GateOverlay"
import type { ContentTier } from "~/components/ContentTierBadge"

export interface ContentGridItem {
	id: string
	thumbnailUrl?: string | null
	title: string
	tier: ContentTier
	isUnlocked: boolean
	keyPrice?: number
	previewUrl?: string
}

interface ContentGridProps {
	items: ContentGridItem[]
	onItemClick?: (item: ContentGridItem) => void
	onUnlockItem?: (item: ContentGridItem) => Promise<void>
	isLoading?: boolean
}

export default function ContentGrid({
	items,
	onItemClick,
	onUnlockItem,
	isLoading = false,
}: ContentGridProps) {
	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						key={i}
						className="aspect-square animate-pulse rounded-xl bg-kumo-fill"
					/>
				))}
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<ImageIcon size={48} className="text-kumo-inactive" weight="duotone" />
				<p className="mt-4 text-kumo-subtle">No content yet</p>
				<p className="mt-1 text-sm text-kumo-inactive">
					This creator hasn't posted anything yet. Check back later!
				</p>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{items.map((item) => (
				<button
					type="button"
					key={item.id}
					onClick={() => onItemClick?.(item)}
					className="group relative aspect-square overflow-hidden rounded-xl border border-kumo-line bg-kumo-fill focus:outline-none focus:ring-2 focus:ring-kumo-brand text-left"
				>
					{/* Thumbnail */}
					{item.thumbnailUrl ? (
						<div className="relative size-full">
							<img
								src={item.thumbnailUrl}
								alt={item.title}
								className={`size-full object-cover transition-transform group-hover:scale-105 ${
									!item.isUnlocked && item.tier !== "public"
										? "blur-lg"
										: ""
								}`}
							/>
							{/* Dim overlay for gated content */}
							{!item.isUnlocked && item.tier !== "public" && (
								<div className="absolute inset-0 bg-black/40" />
							)}
						</div>
					) : (
						<div className="flex size-full items-center justify-center">
							<ImageIcon
								size={32}
								className="text-kumo-inactive"
								weight="duotone"
							/>
						</div>
					)}

					{/* Gate overlay for non-public, non-unlocked content */}
					{!item.isUnlocked && item.tier !== "public" && (
						<div className="absolute inset-0 flex flex-col items-center justify-center p-3">
							<GateOverlay
								contentTier={item.tier}
								keyPrice={item.keyPrice}
								previewUrl={item.previewUrl}
								onUnlock={async () => {
									if (onUnlockItem) await onUnlockItem(item)
								}}
								isLoading={false}
							/>
						</div>
					)}

					{/* Title overlay */}
					<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
						<p className="text-xs font-medium text-white line-clamp-1">
							{item.title}
						</p>
					</div>
				</button>
			))}
		</div>
	)
}
