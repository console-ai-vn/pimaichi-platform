import { Button, Empty, Loader } from "@cloudflare/kumo";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { formatListDate } from "shared/dates";
import { Link, useParams } from "react-router";
import CommentComposer from "~/components/home/CommentComposer";
import CommentList from "~/components/home/CommentList";
import ReactionBar from "~/components/home/ReactionBar";
import MailboxAvatar from "~/components/MailboxAvatar";
import { useHomeComments, useHomeTopic } from "~/queries/home-feed";
import api from "~/services/api";

export function meta() {
	return [{ title: "Topic — VSBG Box" }];
}

export default function HomeTopicRoute() {
	const { mailboxId, topicId } = useParams<{
		mailboxId: string;
		topicId: string;
	}>();
	const { data: topic, isLoading, isError } = useHomeTopic(topicId);
	const { data: commentsData, isLoading: commentsLoading } = useHomeComments(topicId);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<Loader />
			</div>
		);
	}

	if (isError || !topic) {
		return <Empty title="Topic not found" description="It may have been removed." />;
	}

	return (
		<div className="space-y-6">
			<Link to={`/mailbox/${mailboxId}/feed`}>
				<Button variant="ghost" size="sm" icon={<ArrowLeftIcon size={16} />}>
					Back to feed
				</Button>
			</Link>

			<article className="rounded-xl border border-kumo-line bg-kumo-base p-5">
				<div className="flex items-start gap-3">
					<MailboxAvatar
						email={topic.authorEmail}
						name={topic.authorEmail.split("@")[0]}
						size="md"
					/>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-kumo-default">
							{topic.authorEmail.split("@")[0]}
						</p>
						<p className="text-xs text-kumo-subtle">{formatListDate(topic.createdAt)}</p>
						<h1 className="mt-2 text-xl font-semibold text-kumo-default">{topic.title}</h1>
						<div
							className="prose prose-sm mt-3 max-w-none text-kumo-default"
							dangerouslySetInnerHTML={{ __html: topic.bodyHtml }}
						/>
						{topic.images.length > 0 && (
							<div className="mt-4 grid gap-2 sm:grid-cols-2">
								{topic.images.map((image) => (
									<img
										key={image.id}
										src={api.homeTopicImageUrl(topic.id, image.id)}
										alt=""
										className="w-full rounded-lg object-cover"
									/>
								))}
							</div>
						)}
						<div className="mt-4">
							<ReactionBar topic={topic} />
						</div>
					</div>
				</div>
			</article>

			<section className="rounded-xl border border-kumo-line bg-kumo-base p-5">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-kumo-subtle">
					Comments ({topic.commentCount})
				</h2>
				{commentsLoading ? (
					<div className="flex justify-center py-8">
						<Loader />
					</div>
				) : (
					<CommentList comments={commentsData?.comments ?? []} />
				)}
				<CommentComposer topicId={topic.id} />
			</section>
		</div>
	);
}