import { formatListDate } from "shared/dates";
import MailboxAvatar from "~/components/MailboxAvatar";
import api from "~/services/api";
import type { HomeComment } from "~/types";

export default function CommentList({ comments }: { comments: HomeComment[] }) {
	if (comments.length === 0) {
		return (
			<p className="py-6 text-center text-sm text-kumo-subtle">
				No comments yet. Be the first.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{comments.map((comment) => (
				<div key={comment.id} className="flex gap-3">
					<MailboxAvatar
						email={comment.authorEmail}
						name={comment.authorEmail.split("@")[0]}
						size="sm"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-kumo-default">
								{comment.authorEmail.split("@")[0]}
							</span>
							<span className="text-xs text-kumo-subtle">
								{formatListDate(comment.createdAt)}
							</span>
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
			))}
		</div>
	);
}