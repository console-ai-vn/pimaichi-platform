import { useCallback, useState } from "react"
import { useNavigate, useParams } from "react-router"
import CreatorHeader from "~/components/CreatorHeader"
import ContentGrid from "~/components/ContentGrid"
import { SkeletonHero, SkeletonGrid } from "~/components/SkeletonLoader"
import {
	useCreatorProfile,
	useCreatorContent,
	useCreatorShop,
} from "~/queries/creator"
import type { ContentGridItem, ShopGridItem } from "~/components/ContentGrid"
import type { ContentTier } from "~/components/ContentTierBadge"

export function meta({
	data,
}: {
	data: ReturnType<typeof useCreatorProfile>
}) {
	if (!data?.data) {
		return [
			{ title: "Creator Profile — ONYX" },
			{
				name: "description",
				content: "Discover exclusive content from creators on ONYX.",
			},
		]
	}
	const c = data.data
	return [
		{ title: `${c.name} — ONYX` },
		{
			name: "description",
			content:
				c.bio?.replace(/<[^>]*>/g, "").slice(0, 160) ||
				`Subscribe to ${c.name} on ONYX for exclusive content.`,
		},
		{ property: "og:title", content: `${c.name} on ONYX` },
		{
			property: "og:description",
			content:
				c.bio?.replace(/<[^>]*>/g, "").slice(0, 200) ||
				`Check out ${c.name}'s exclusive content on ONYX.`,
		},
		{ property: "og:image", content: c.avatarUrl || "/favicon.svg" },
		{ property: "og:type", content: "profile" },
	]
}

export default function CreatorRoute() {
	const { creatorId } = useParams<{ creatorId: string }>()
	const navigate = useNavigate()
	const [activeTab, setActiveTab] = useState("posts")
	const [contentPage, setContentPage] = useState(1)

	const profile = useCreatorProfile(creatorId!)
	const content = useCreatorContent(creatorId!, contentPage)
	const shop = useCreatorShop(creatorId!)

	const creator = profile.data

	const handleSubscribe = useCallback(() => {
		if (creator) {
			navigate(`/signup?creator=${encodeURIComponent(creator.id)}`)
		}
	}, [creator, navigate])

	const handleItemClick = useCallback(
		(item: ContentGridItem) => {
			// Navigate to item detail or open gate modal
			console.log("Item clicked:", item.id)
		},
		[],
	)

	const handleUnlockItem = useCallback(
		async (item: ContentGridItem) => {
			navigate(`/checkout?itemId=${encodeURIComponent(item.id)}`)
		},
		[navigate],
	)

	const handleShopPurchase = useCallback(
		(item: ShopGridItem) => {
			navigate(`/checkout?itemId=${encodeURIComponent(item.id)}`)
		},
		[navigate],
	)

	// Loading state
	if (profile.isLoading) {
		return (
			<div className="min-h-screen bg-kumo-recessed">
				<SkeletonHero />
				<div className="mx-auto max-w-5xl px-4 py-8">
					<div className="mb-6 h-10 w-40 animate-pulse rounded bg-kumo-fill" />
					<SkeletonGrid count={8} cols={4} />
				</div>
			</div>
		)
	}

	// Error state
	if (profile.isError || !creator) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-kumo-recessed p-8">
				<div className="animate-fade-in rounded-2xl border border-kumo-line bg-kumo-base p-8 text-center">
					<h1 className="text-xl font-bold text-kumo-default">
						Creator Not Found
					</h1>
					<p className="mt-2 text-kumo-subtle">
						This creator page doesn't exist or may have been removed.
					</p>
					<button
						type="button"
						onClick={() => navigate("/app")}
						className="mt-6 rounded-xl bg-kumo-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kumo-brand-dark"
					>
						Go Home
					</button>
				</div>
			</div>
		)
	}

	const contentItems: ContentGridItem[] =
		content.data?.items?.map((post) => ({
			id: post.id,
			thumbnailUrl: post.thumbnailUrl,
			title: post.title,
			tier: post.tier as ContentTier,
			isUnlocked: post.isUnlocked,
			keyPrice: post.keyPrice,
			previewUrl: post.previewUrl,
		})) ?? []

	const shopItems: ShopGridItem[] =
		shop.data?.map((item) => ({
			id: item.id,
			type: item.type,
			name: item.name,
			description: item.description,
			price: item.price,
			imageUrl: item.imageUrl,
		})) ?? []

	// Extract handle from email address
	const handle = creator.id.includes("@")
		? creator.id.split("@")[0]
		: creator.name.toLowerCase().replace(/\s+/g, "")

	return (
		<div className="min-h-screen bg-kumo-recessed">
			{/* Sticky Creator Header */}
			<CreatorHeader
				creator={{
					name: creator.name,
					handle,
					bio: creator.bio,
					avatarUrl: creator.avatarUrl,
					coverUrl: creator.coverUrl,
					subscriberCount: creator.subscriberCount,
					postCount: creator.postCount,
					itemCount: creator.itemCount,
				}}
				isSubscribed={false}
				onSubscribe={handleSubscribe}
			/>

			{/* Content area */}
			<div className="mx-auto max-w-5xl px-4 py-4">
				<ContentGrid
					items={contentItems}
					shopItems={shopItems}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					onItemClick={handleItemClick}
					onUnlockItem={handleUnlockItem}
					onShopPurchase={handleShopPurchase}
					isLoading={content.isLoading}
				/>

				{/* Pagination for posts */}
				{activeTab === "posts" &&
					content.data &&
					content.data.totalCount > content.data.limit && (
						<div className="mt-6 flex items-center justify-center gap-3">
							<button
								type="button"
								disabled={contentPage <= 1}
								onClick={() =>
									setContentPage((p) => Math.max(1, p - 1))
								}
								className="rounded-lg border border-kumo-line bg-kumo-base px-3 py-1.5 text-sm text-kumo-subtle transition-colors hover:bg-kumo-fill disabled:opacity-40"
							>
								Previous
							</button>
							<span className="text-sm text-kumo-subtle">
								Page {contentPage} of{" "}
								{Math.ceil(
									content.data.totalCount / content.data.limit,
								)}
							</span>
							<button
								type="button"
								disabled={
									contentPage >=
									Math.ceil(
										content.data.totalCount /
											content.data.limit,
									)
								}
								onClick={() => setContentPage((p) => p + 1)}
								className="rounded-lg border border-kumo-line bg-kumo-base px-3 py-1.5 text-sm text-kumo-subtle transition-colors hover:bg-kumo-fill disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}
			</div>

			{/* Structured data for SEO */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "Person",
						name: creator.name,
						description: creator.bio?.replace(/<[^>]*>/g, ""),
						url: `https://start.onyx.com.vn/${encodeURIComponent(
							creator.id,
						)}`,
						image: creator.avatarUrl,
					}),
				}}
			/>
		</div>
	)
}
