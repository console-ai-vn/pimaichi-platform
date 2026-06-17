import { useRef } from "react"
import { Plus, UserCircle } from "@phosphor-icons/react"
import { cfThumbUrl } from "~/lib/cf-images"
import type { Story } from "~/queries/feed"

interface StoryBarProps {
	stories: Story[]
	onStoryTap: (story: Story, index: number) => void
	onAddStory?: () => void
}

const tierRingColors: Record<string, string> = {
	public: "ring-[#22c55e]",
	subscribers: "ring-[#3b82f6]",
	ppv: "ring-[#f59e0b]",
}

/**
 * Horizontal scrollable story bar (Instagram-style).
 * Shows "Your Story" first with + icon, then creator stories
 * with tier-colored rings. Live indicator with pulsing red dot.
 */
export default function StoryBar({ stories, onStoryTap, onAddStory }: StoryBarProps) {
	const scrollRef = useRef<HTMLDivElement>(null)

	return (
		<div
			ref={scrollRef}
			className="scrollbar-hide flex gap-3 overflow-x-auto px-3 py-3 snap-x snap-mandatory"
		>
			{/* Your Story */}
			{onAddStory && (
				<button
					type="button"
					onClick={onAddStory}
					className="flex shrink-0 snap-center flex-col items-center gap-1"
				>
					<div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-kumo-line bg-kumo-fill transition-transform hover:scale-105">
						<UserCircle size={32} className="text-kumo-subtle" weight="duotone" />
						<div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-kumo-brand ring-2 ring-kumo-base">
							<Plus size={14} className="text-white" weight="bold" />
						</div>
					</div>
					<span className="text-[10px] text-kumo-subtle">Your Story</span>
				</button>
			)}

			{/* Creator stories */}
			{stories.map((story, idx) => {
				const ringColor = tierRingColors[story.tier] || tierRingColors.public

				return (
					<button
						key={story.id}
						type="button"
						onClick={() => onStoryTap(story, idx)}
						className="flex shrink-0 snap-center flex-col items-center gap-1"
					>
						<div
							className={`relative h-16 w-16 rounded-full p-[2px] transition-transform hover:scale-105 ${
								story.seen
									? "bg-kumo-line"
									: `bg-gradient-to-tr ${ringColor} to-purple-500`
							}`}
						>
							<div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-kumo-fill ring-2 ring-kumo-base">
								{story.avatarUrl || story.imageId ? (
									<img
										src={cfThumbUrl(story.imageId) || story.avatarUrl!}
										alt={story.creatorName}
										className="h-full w-full object-cover"
										loading="lazy"
									/>
								) : (
									<UserCircle
										size={28}
										className="text-kumo-subtle"
										weight="fill"
									/>
								)}
							</div>

							{/* Live indicator */}
							{story.live && (
								<div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 ring-2 ring-kumo-base">
									<div className="flex items-center gap-1">
										<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
										<span className="text-[8px] font-bold text-white">
											LIVE
										</span>
									</div>
								</div>
							)}
						</div>
						<span className="max-w-[64px] truncate text-[10px] text-kumo-subtle">
							{story.creatorName}
						</span>
					</button>
				)
			})}

			{/* Empty state inline */}
			{stories.length === 0 && !onAddStory && (
				<div className="flex shrink-0 items-center gap-2 px-2">
					<div className="h-12 w-12 animate-pulse rounded-full bg-kumo-fill" />
					<div className="h-12 w-12 animate-pulse rounded-full bg-kumo-fill" />
					<div className="h-12 w-12 animate-pulse rounded-full bg-kumo-fill" />
					<p className="ml-2 text-xs text-kumo-inactive">
						No stories yet — follow creators!
					</p>
				</div>
			)}
		</div>
	)
}
