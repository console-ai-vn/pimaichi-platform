import { Button, Empty, Loader } from "@cloudflare/kumo";
import { useKumoToastManager } from "@cloudflare/kumo";
import { ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react";
import { formatListDate } from "shared/dates";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import CommentComposer from "~/components/home/CommentComposer";
import CommentList from "~/components/home/CommentList";
import ReactionBar from "~/components/home/ReactionBar";
import MemberProfileTrigger from "~/components/home/MemberProfileTrigger";
import { isSameMemberEmail, useViewerEmail } from "~/hooks/useViewerEmail";
import {
	useDeleteHomeTopic,
	useHomeCommentsInfinite,
	useHomeTopic,
} from "~/queries/home-feed";
import { queryKeys } from "~/queries/keys";
import api from "~/services/api";

export function meta() {
	return [{ title: "Topic — VSBG Box" }];
}

export default function HomeTopicRoute() {
	const { mailboxId, topicId } = useParams<{
		mailboxId: string;
		topicId: string;
	}>();
	const navigate = useNavigate();
	const toast = useKumoToastManager();
	const viewerEmail = useViewerEmail();
	const { data: topic, isLoading, isError } = useHomeTopic(topicId);
	const {
		data: commentsPages,
		isLoading: commentsLoading,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useHomeCommentsInfinite(topicId);
	const deleteTopic = useDeleteHomeTopic();
	const { data: config } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: 60_000,
	});
	const isAdmin = config?.isAdmin ?? false;
	const comments = commentsPages?.pages.flatMap((page) => page.comments) ?? [];
	const canDeleteTopic =
		isAdmin || (topic ? isSameMemberEmail(viewerEmail, topic.authorEmail) : false);

	const handleDeleteTopic = async () => {
		if (!topicId || !topic) return;
		if (!window.confirm(`Delete "${topic.title}" and all comments?`)) return;
		try {
			await deleteTopic.mutateAsync(topicId);
			toast.add({ title: "Topic deleted" });
			navigate(`/mailbox/${mailboxId}/feed`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Could not delete topic";
			toast.add({ title: message, variant: "error" });
		}
	};

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

			<article className="rounded-xl border border-kumo-line bg-kumo-base p-5 shadow-sm">
				{canDeleteTopic && (
					<div className="mb-3 flex justify-end">
						<Button
							variant="ghost"
							size="sm"
							icon={<TrashIcon size={16} />}
							loading={deleteTopic.isPending}
							onClick={() => void handleDeleteTopic()}
						>
							Delete post
						</Button>
					</div>
				)}
				<div className="flex items-start gap-3">
					<MemberProfileTrigger
						email={topic.authorEmail}
						avatarSize="md"
						showName={false}
						layout="avatar-only"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<MemberProfileTrigger
								email={topic.authorEmail}
								showName
								layout="name-only"
								nameClassName="font-semibold"
							/>
							<span className="text-xs text-kumo-subtle">
								{formatListDate(topic.createdAt)}
							</span>
						</div>
						<h1 className="mt-2 text-xl font-semibold text-kumo-default">
							{topic.title}
						</h1>
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
						<div className="mt-4 border-t border-kumo-line pt-3">
							<ReactionBar topic={topic} />
						</div>
					</div>
				</div>
			</article>

			<section className="rounded-xl border border-kumo-line bg-kumo-base p-5 shadow-sm">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-kumo-subtle">
					Comments ({topic.commentCount})
				</h2>
				{commentsLoading ? (
					<div className="flex justify-center py-8">
						<Loader />
					</div>
				) : (
					<CommentList
						comments={comments}
						topicId={topic.id}
						viewerEmail={viewerEmail}
						isAdmin={isAdmin}
					/>
				)}
				{hasNextPage && (
					<div className="flex justify-center py-3">
						<Button
							variant="secondary"
							size="sm"
							loading={isFetchingNextPage}
							onClick={() => void fetchNextPage()}
						>
							Load more comments
						</Button>
					</div>
				)}
				<CommentComposer topicId={topic.id} />
			</section>
		</div>
	);
}