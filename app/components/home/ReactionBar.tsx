import { Button } from "@cloudflare/kumo";
import { ChatCircleIcon, ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import { useSetHomeReaction } from "~/queries/home-feed";
import type { HomeTopic } from "~/types";

export default function ReactionBar({
	topic,
	showCommentCount = false,
}: {
	topic: HomeTopic;
	showCommentCount?: boolean;
}) {
	const reactionMutation = useSetHomeReaction(topic.id);

	const toggle = (next: "like" | "dislike") => {
		const current = topic.userReaction;
		const value = current === next ? null : next;
		reactionMutation.mutate(value);
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant={topic.userReaction === "like" ? "secondary" : "ghost"}
				size="sm"
				icon={
					<ThumbsUpIcon
						size={16}
						weight={topic.userReaction === "like" ? "fill" : "regular"}
					/>
				}
				onClick={() => toggle("like")}
				disabled={reactionMutation.isPending}
				className={topic.userReaction === "like" ? "text-kumo-brand" : ""}
			>
				{topic.likeCount > 0 ? topic.likeCount : "Like"}
			</Button>
			<Button
				variant={topic.userReaction === "dislike" ? "secondary" : "ghost"}
				size="sm"
				icon={
					<ThumbsDownIcon
						size={16}
						weight={topic.userReaction === "dislike" ? "fill" : "regular"}
					/>
				}
				onClick={() => toggle("dislike")}
				disabled={reactionMutation.isPending}
			>
				{topic.dislikeCount > 0 ? topic.dislikeCount : "Dislike"}
			</Button>
			{showCommentCount && (
				<span className="inline-flex items-center gap-1 text-sm text-kumo-subtle">
					<ChatCircleIcon size={16} />
					{topic.commentCount}
				</span>
			)}
		</div>
	);
}