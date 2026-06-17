import { useCallback, useState } from "react"
import { useNavigate } from "react-router"
import GridFeed from "~/components/GridFeed"
import StoryBar from "~/components/StoryBar"
import StoryViewer from "~/components/StoryViewer"
import { useFeedFeed, useStories } from "~/queries/feed"
import type { FeedItem, Story } from "~/queries/feed"

export function meta() {
	return [{ title: "Feed — ONYX" }]
}

export default function FeedTab() {
	const navigate = useNavigate()
	const [storyViewer, setStoryViewer] = useState<{
		stories: Story[]
		index: number
	} | null>(null)

	const feed = useFeedFeed()
	const stories = useStories()

	// Flatten infinite query pages into items array
	const feedItems: FeedItem[] =
		feed.data?.pages.flatMap((p) => p.items) ?? []

	const storyList = stories.data?.stories ?? []

	const handleRefresh = useCallback(() => {
		feed.refetch()
		stories.refetch()
	}, [feed, stories])

	const handleLoadMore = useCallback(() => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) {
			feed.fetchNextPage()
		}
	}, [feed])

	const handleItemClick = useCallback(
		(item: FeedItem) => {
			navigate(`/${encodeURIComponent(item.creatorId)}`)
		},
		[navigate],
	)

	const handleStoryTap = useCallback(
		(story: Story, index: number) => {
			setStoryViewer({ stories: storyList, index })
		},
		[storyList],
	)

	const handleCloseStoryViewer = useCallback(() => {
		setStoryViewer(null)
	}, [])

	return (
		<div className="min-h-screen bg-kumo-recessed">
			{/* Story bar */}
			<StoryBar
				stories={storyList}
				onStoryTap={handleStoryTap}
			/>

			{/* Feed grid */}
			<GridFeed
				items={feedItems}
				isLoading={feed.isLoading}
				hasMore={!!feed.hasNextPage}
				onLoadMore={handleLoadMore}
				onRefresh={handleRefresh}
				onItemClick={handleItemClick}
			/>

			{/* Story viewer overlay */}
			{storyViewer && (
				<StoryViewer
					stories={storyViewer.stories}
					initialIndex={storyViewer.index}
					onClose={handleCloseStoryViewer}
				/>
			)}
		</div>
	)
}
