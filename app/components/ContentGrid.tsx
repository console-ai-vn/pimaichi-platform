import { ImageIcon, LockKey, LockIcon } from "@phosphor-icons/react"
import Tabs from "~/components/Tabs"
import ItemCard from "~/components/ItemCard"
import type { ContentTier } from "~/components/ContentTierBadge"

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface ContentGridItem {
	id: string
	thumbnailUrl?: string | null
	imageId?: string | null
	title: string
	tier: ContentTier
	isUnlocked: boolean
	keyPrice?: number
	previewUrl?: string
}

export interface ShopGridItem {
	id: string
	type: string
	name: string
	description: string
	price: number
	imageUrl: string | null
}

export interface MediaGridItem {
	id: string
	thumbnailUrl?: string | null
	imageId?: string | null
	title: string
	duration?: number
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface ContentGridProps {
	items: ContentGridItem[]
	mediaItems?: MediaGridItem[]
	shopItems?: ShopGridItem[]
	activeTab?: string
	onTabChange?: (tab: string) => void
	onItemClick?: (item: ContentGridItem) => void
	onMediaClick?: (item: MediaGridItem) => void
	onShopPurchase?: (item: ShopGridItem) => void
	onUnlockItem?: (item: ContentGridItem) => Promise<void>
	isLoading?: boolean
}

// ----------------------------------------------------------------
// ContentGrid — tabbed grid for creator profile
// ----------------------------------------------------------------
export default function ContentGrid({
	items,
	mediaItems = [],
	shopItems = [],
	activeTab,
	onTabChange,
	onItemClick,
	onMediaClick,
	onShopPurchase,
	onUnlockItem,
	isLoading = false,
}: ContentGridProps) {
	const hasTabs = !!activeTab && !!onTabChange
	const tabs = [
		{ id: "posts", label: "Posts" },
		{ id: "media", label: "Media" },
		{ id: "shop", label: "Shop" },
	]

	const currentTab = activeTab || "posts"

	// Skeleton loading
	if (isLoading) {
		return (
			<div>
				{hasTabs && (
					<Tabs
						tabs={tabs}
						activeTab={currentTab}
						onChange={onTabChange!}
					/>
				)}
				<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							key={i}
							className="aspect-square animate-pulse rounded-xl bg-kumo-fill"
						/>
					))}
				</div>
			</div>
		)
	}

	// Render tab content
	const renderPosts = () => {
		if (items.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<ImageIcon
						size={48}
						className="text-kumo-inactive"
						weight="duotone"
					/>
					<p className="mt-4 text-kumo-subtle">No posts yet</p>
					<p className="mt-1 text-sm text-kumo-inactive">
						This creator hasn't posted anything yet. Check back later!
					</p>
				</div>
			)
		}

		return (
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
				{items.map((item) => {
					const isGated = !item.isUnlocked && item.tier !== "public"
					return (
						<button
							type="button"
							key={item.id}
							onClick={() => onItemClick?.(item)}
							className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-kumo-line bg-kumo-fill text-left focus:outline-none focus:ring-2 focus:ring-kumo-brand"
						>
							{/* Thumbnail */}
							{item.thumbnailUrl ? (
								<div className="relative size-full">
									<img
										src={item.thumbnailUrl}
										alt={item.title}
										className={`size-full object-cover transition-transform group-hover:scale-105 ${
											isGated ? "blur-lg" : ""
										}`}
										loading="lazy"
										decoding="async"
									/>
									{isGated && (
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

							{/* Lock badge for gated */}
							{isGated && (
								<div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur">
									{item.tier === "ppv" ? (
										<LockKey
											size={12}
											className="text-amber-400"
											weight="fill"
										/>
									) : (
										<LockIcon
											size={12}
											className="text-blue-400"
											weight="fill"
										/>
									)}
									<span className="text-[10px] font-medium text-white">
										{item.tier === "ppv" ? "PPV" : "SUB"}
									</span>
								</div>
							)}

							{/* Title overlay */}
							<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
								<p className="truncate text-xs font-medium text-white">
									{item.title}
								</p>
							</div>
						</button>
					)
				})}
			</div>
		)
	}

	const renderMedia = () => {
		if (mediaItems.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<ImageIcon
						size={48}
						className="text-kumo-inactive"
						weight="duotone"
					/>
					<p className="mt-4 text-kumo-subtle">No media yet</p>
				</div>
			)
		}

		return (
			<div className="grid grid-cols-2 gap-2">
				{mediaItems.map((item) => (
					<button
						type="button"
						key={item.id}
						onClick={() => onMediaClick?.(item)}
						className="group relative aspect-video overflow-hidden rounded-xl border border-kumo-line bg-kumo-fill text-left focus:outline-none focus:ring-2 focus:ring-kumo-brand"
					>
						{item.thumbnailUrl ? (
							<img
								src={item.thumbnailUrl}
								alt={item.title}
								className="size-full object-cover transition-transform group-hover:scale-105"
								loading="lazy"
							/>
						) : (
							<div className="flex size-full items-center justify-center">
								<ImageIcon
									size={32}
									className="text-kumo-inactive"
									weight="duotone"
								/>
							</div>
						)}
						<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
							<p className="truncate text-xs font-medium text-white">
								{item.title}
							</p>
						</div>
					</button>
				))}
			</div>
		)
	}

	const renderShop = () => {
		if (shopItems.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<p className="text-kumo-subtle">No items in shop yet</p>
					<p className="mt-1 text-sm text-kumo-inactive">
						This creator hasn't added any items to their shop.
					</p>
				</div>
			)
		}

		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{shopItems.map((item) => (
					<ItemCard
						key={item.id}
						item={{
							id: item.id,
							name: item.name,
							description: item.description,
							price: item.price,
							imageUrl: item.imageUrl,
							type: item.type,
						}}
						onPurchase={() => onShopPurchase?.(item)}
					/>
				))}
			</div>
		)
	}

	return (
		<div>
			{hasTabs && (
				<div className="mb-3">
					<Tabs
						tabs={tabs}
						activeTab={currentTab}
						onChange={onTabChange!}
					/>
				</div>
			)}

			{currentTab === "posts" && renderPosts()}
			{currentTab === "media" && renderMedia()}
			{currentTab === "shop" && renderShop()}
		</div>
	)
}
