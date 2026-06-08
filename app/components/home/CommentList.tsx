import { Button, Tooltip } from "@cloudflare/kumo";
import { TrashIcon } from "@phosphor-icons/react";
import { useKumoToastManager } from "@cloudflare/kumo";
import { formatListDate } from "shared/dates";
import MemberProfileTrigger from "~/components/home/MemberProfileTrigger";
import { isSameMemberEmail } from "~/hooks/useViewerEmail";
import { useDeleteHomeComment } from "~/queries/home-feed";
import api from "~/services/api";
import type { HomeComment } from "~/types";

interface CommentListProps {
	comments: HomeComment[];
	topicId: string;
	viewerEmail?: string;
	isAdmin?: boolean;
}

export default function CommentList({
	comments,
	topicId,
	viewerEmail = "",
	isAdmin = false,
}: CommentListProps) {
	const toast = useKumoToastManager();
	const deleteComment = useDeleteHomeComment(topicId);

	const handleDelete = async (commentId: string) => {
		if (!window.confirm("Delete this comment?")) return;
		try {
			await deleteComment.mutateAsync(commentId);
			toast.add({ title: "Comment deleted" });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Could not delete comment";
			toast.add({ title: message, variant: "error" });
		}
	};

	if (comments.length === 0) {
		return (
			<p className="py-6 text-center text-sm text-kumo-subtle">
				No comments yet. Be the first.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{comments.map((comment) => {
				const canDelete =
					isAdmin || isSameMemberEmail(viewerEmail, comment.authorEmail);

				return (
					<div
						key={comment.id}
						className="flex gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-kumo-line hover:bg-kumo-recessed/40"
					>
						<MemberProfileTrigger
							email={comment.authorEmail}
							avatarSize="sm"
							showName={false}
							layout="avatar-only"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<MemberProfileTrigger
									email={comment.authorEmail}
									showName
									layout="name-only"
									nameClassName="font-medium"
								/>
								<span className="text-xs text-kumo-subtle">
									{formatListDate(comment.createdAt)}
								</span>
								{canDelete && (
									<Tooltip content="Delete comment" side="top" asChild>
										<Button
											variant="ghost"
											shape="square"
											size="sm"
											className="ml-auto"
											icon={<TrashIcon size={14} />}
											loading={deleteComment.isPending}
											onClick={() => void handleDelete(comment.id)}
											aria-label="Delete comment"
										/>
									</Tooltip>
								)}
							</div>
							{comment.bodyHtml && (
								<div
									className="prose prose-sm mt-1 max-w-none text-kumo-default"
									dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
								/>
							)}
							{comment.images.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{comment.images.map((image) => (
										<img
											key={image.id}
											src={api.homeCommentImageUrl(comment.id, image.id)}
											alt=""
											className="max-h-40 rounded-lg object-cover"
										/>
									))}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}