import { Button } from "@cloudflare/kumo";
import { ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import { useSetHomeReaction } from "~/queries/home-feed";
import type { HomeTopic } from "~/types";

export default function ReactionBar({ topic }: { topic: HomeTopic }) {
	const reactionMutation = useSetHomeReaction(topic.id);

	const toggle = (next: "like" | "dislike") => {
		const current = topic.userReaction;
		const value = current === next ? null : next;
		reactionMutation.mutate(value);
	};

	return (
		<div className="flex items-center gap-2">
			<Button
				variant={topic.userReaction === "like" ? "primary" : "secondary"}
				size="sm"
				icon={<ThumbsUpIcon size={16} weight={topic.userReaction === "like" ? "fill" : "regular"} />}
				onClick={() => toggle("like")}
				disabled={reactionMutation.isPending}
			>
				{topic.likeCount}
			</Button>
			<Button
				variant={topic.userReaction === "dislike" ? "primary" : "secondary"}
				size="sm"
				icon={<ThumbsDownIcon size={16} weight={topic.userReaction === "dislike" ? "fill" : "regular"} />}
				onClick={() => toggle("dislike")}
				disabled={reactionMutation.isPending}
			>
				{topic.dislikeCount}
			</Button>
		</div>
	);
}