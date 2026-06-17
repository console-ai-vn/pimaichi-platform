import { useCallback, useEffect, useRef } from "react"
import { Loader } from "@cloudflare/kumo"
import { useGridLayout } from "~/hooks/useGridLayout"
import { usePullRefresh } from "~/lib/gesture-utils"
import FeedCard from "./FeedCard"
import type { FeedItem } from "~/queries/feed"

interface GridFeedProps {
	items: FeedItem[]
	isLoading: boolean
	hasMore: boolean
	onLoadMore: () => void
	onRefresh?: () => void
	onItemClick?: (item: FeedItem) => void
}

/**
 * Responsive grid feed with infinite scroll via IntersectionObserver.
 * Pull-to-refresh triggers onRefresh() callback.
 * Images lazy-loaded natively via loading="lazy".
 */
export default function GridFeed({
	items,
	isLoading,
	hasMore,
	onLoadMore,
	onRefresh,
	onItemClick,
}: GridFeedProps) {
	const { columns } = useGridLayout()
	const containerRef = useRef<HTMLDivElement>(null)
	const sentinelRef = useRef<HTMLDivElement>(null)

	// Pull-to-refresh
	const pullState = usePullRefresh(
		containerRef as React.RefObject<HTMLElement>,
		() => onRefresh?.(),
		60,
	)

	// IntersectionObserver for infinite scroll
	const observerRef = useRef<IntersectionObserver | null>(null)
	const loadMoreRef = useRef(onLoadMore)
	loadMoreRef.current = onLoadMore

	useEffect(() => {
		if (!sentinelRef.current) return
		observerRef.current?.disconnect()

		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && hasMore && !isLoading) {
					loadMoreRef.current()
				}
			},
			{ rootMargin: "500px" },
		)

		observerRef.current.observe(sentinelRef.current)

		return () => {
			observerRef.current?.disconnect()
		}
	}, [hasMore, isLoading])

	// Map column count to grid class
	const gridCols =
		columns === 2
			? "grid-cols-2"
			: columns === 3
				? "grid-cols-3"
				: "grid-cols-4"

	// Skeleton loading
	if (isLoading && items.length === 0) {
		return (
			<div ref={containerRef as React.RefObject<HTMLDivElement>} className="px-2 py-2">
				<div className={`grid gap-2 ${gridCols}`}>
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-kumo-fill" />
					))}
				</div>
			</div>
		)
	}

	// Empty state
	if (!isLoading && items.length === 0) {
		return (
			<div
				ref={containerRef as React.RefObject<HTMLDivElement>}
				className="flex flex-col items-center justify-center px-4 py-16 text-center"
			>
				<div className="mb-4 text-4xl">📭</div>
				<p className="text-kumo-subtle">No posts yet</p>
				<p className="mt-1 text-sm text-kumo-inactive">
					Follow creators to see their content here.
				</p>
			</div>
		)
	}

	return (
		<div
			ref={containerRef as React.RefObject<HTMLDivElement>}
			className="relative px-2 py-2"
		>
			{/* Pull-to-refresh indicator */}
			{pullState.isPulling && (
				<div
					className="flex items-center justify-center transition-all"
					style={{ height: `${pullState.pullDistance}px` }}
				>
					<div
						className={`h-5 w-5 animate-spin rounded-full border-2 border-kumo-brand border-t-transparent ${
							pullState.pullDistance >= 60 ? "opacity-100" : "opacity-50"
						}`}
					/>
				</div>
			)}

			{/* Grid */}
			<div className={`grid gap-2 ${gridCols}`}>
				{items.map((item, idx) => (
					<div
						key={`${item.id}-${idx}`}
						className="animate-fade-in"
						style={{ animationDelay: `${(idx % 8) * 50}ms` }}
					>
						<FeedCard
							creator={{
								name: item.creatorName,
								avatarUrl: item.creatorAvatarUrl,
							}}
							thumbnail={item.thumbnailUrl}
							imageId={item.imageId}
							title={item.title}
							tier={item.tier}
							subscriberCount={item.subscriberCount}
							isNew={item.isNew}
							onClick={() => onItemClick?.(item)}
						/>
					</div>
				))}
			</div>

			{/* Infinite scroll sentinel */}
			{hasMore && (
				<div
					ref={sentinelRef}
					className="flex items-center justify-center py-4"
				>
					{isLoading && (
						<Loader size="sm" className="text-kumo-brand" />
					)}
				</div>
			)}

			{/* No more content indicator */}
			{!hasMore && items.length > 0 && (
				<div className="py-6 text-center text-xs text-kumo-inactive">
					You've reached the end
				</div>
			)}
		</div>
	)
}
