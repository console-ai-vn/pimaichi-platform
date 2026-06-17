import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import type { CreatorProfile, CreatorContentItem } from "./creator"

// ----------------------------------------------------------------
// Query key factories
// ----------------------------------------------------------------
export const feedKeys = {
	feed: ["feed", "following"] as const,
	explore: ["feed", "explore"] as const,
	stories: ["feed", "stories"] as const,
	creatorContent: (creatorId: string) =>
		["feed", "creator", creatorId, "content"] as const,
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface FeedItem {
	id: string
	creatorId: string
	creatorName: string
	creatorAvatarUrl?: string | null
	thumbnailUrl?: string | null
	imageId?: string | null
	title: string
	tier: "public" | "subscribers" | "ppv"
	subscriberCount: number
	isNew: boolean
	createdAt: string
}

export interface Story {
	id: string
	creatorId: string
	creatorName: string
	avatarUrl?: string | null
	imageId?: string | null
	imageUrl?: string | null
	tier: "public" | "subscribers" | "ppv"
	seen: boolean
	live: boolean
}

export interface FeedResponse {
	items: FeedItem[]
	cursor?: string | null
	hasMore: boolean
}

export interface StoriesResponse {
	stories: Story[]
}

// ----------------------------------------------------------------
// Following feed — cursor-based infinite scroll
// ----------------------------------------------------------------
export function useFeedFeed() {
	return useInfiniteQuery({
		queryKey: feedKeys.feed,
		queryFn: async ({ pageParam }): Promise<FeedResponse> => {
			const cursor = pageParam ? `?cursor=${encodeURIComponent(pageParam as string)}` : ""
			const res = await fetch(`/api/v1/feed${cursor}`)
			if (!res.ok) throw new Error("Failed to load feed")
			return res.json()
		},
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) =>
			lastPage.hasMore ? lastPage.cursor ?? null : undefined,
		staleTime: 30_000,
	})
}

// ----------------------------------------------------------------
// Explore feed — all public content, cursor-based
// ----------------------------------------------------------------
export function useExploreFeed() {
	return useInfiniteQuery({
		queryKey: feedKeys.explore,
		queryFn: async ({ pageParam }): Promise<FeedResponse> => {
			const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : ""
			const res = await fetch(`/api/v1/creator/top?limit=20${cursor}`)
			if (!res.ok) throw new Error("Failed to load explore feed")
			const creators: CreatorProfile[] = await res.json()
			// Map top creators to feed items
			const items: FeedItem[] = creators.map((c) => ({
				id: c.id,
				creatorId: c.id,
				creatorName: c.name,
				creatorAvatarUrl: c.avatarUrl,
				thumbnailUrl: c.coverUrl,
				imageId: null,
				title: c.bio?.replace(/<[^>]*>/g, "").slice(0, 100) || "",
				tier: (c.subscriptionTier as "public" | "subscribers" | "ppv") || "public",
				subscriberCount: c.subscriberCount,
				isNew: false,
				createdAt: new Date().toISOString(),
			}))
			return { items, hasMore: creators.length >= 20, cursor: null }
		},
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) =>
			lastPage.hasMore ? lastPage.cursor ?? null : undefined,
		staleTime: 120_000,
	})
}

// ----------------------------------------------------------------
// Creator content — paginated
// ----------------------------------------------------------------
export function useCreatorContentInfinite(creatorId: string) {
	return useInfiniteQuery({
		queryKey: feedKeys.creatorContent(creatorId),
		queryFn: async ({ pageParam = 1 }): Promise<{
			items: CreatorContentItem[]
			totalCount: number
			page: number
			limit: number
		}> => {
			const res = await fetch(
				`/api/v1/creator/${encodeURIComponent(creatorId)}/content?page=${pageParam}&limit=20`,
			)
			if (!res.ok) throw new Error("Failed to load creator content")
			return res.json()
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const loaded = lastPage.page * lastPage.limit
			return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined
		},
		enabled: !!creatorId,
		staleTime: 30_000,
	})
}

// ----------------------------------------------------------------
// Active stories from following
// ----------------------------------------------------------------
export function useStories() {
	return useQuery({
		queryKey: feedKeys.stories,
		queryFn: async (): Promise<StoriesResponse> => {
			const res = await fetch("/api/v1/stories")
			if (!res.ok) {
				// Stories API might not exist yet — return empty gracefully
				if (res.status === 404) return { stories: [] }
				throw new Error("Failed to load stories")
			}
			return res.json()
		},
		staleTime: 60_000,
	})
}

// ----------------------------------------------------------------
// Invalidate helpers
// ----------------------------------------------------------------
export function useInvalidateFeed() {
	const qc = useQueryClient()
	return {
		invalidateFeed: () => qc.invalidateQueries({ queryKey: feedKeys.feed }),
		invalidateExplore: () =>
			qc.invalidateQueries({ queryKey: feedKeys.explore }),
		invalidateStories: () =>
			qc.invalidateQueries({ queryKey: feedKeys.stories }),
		invalidateCreatorContent: (creatorId: string) =>
			qc.invalidateQueries({ queryKey: feedKeys.creatorContent(creatorId) }),
	}
}
