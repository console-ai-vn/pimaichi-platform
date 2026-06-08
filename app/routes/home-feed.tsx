import { Button, Empty, Loader } from "@cloudflare/kumo";
import { GearIcon, PlusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import CreateTopicSheet from "~/components/home/CreateTopicSheet";
import TopicCard from "~/components/home/TopicCard";
import MailboxAvatar from "~/components/MailboxAvatar";
import { getAvatarVersion, useAvatarVersionMap } from "~/hooks/useAvatarVersions";
import {
	resolveMemberDisplayName,
	useMemberDisplayNames,
} from "~/hooks/useMemberDisplayNames";
import { useViewerEmail } from "~/hooks/useViewerEmail";
import { useHomeTopicsInfinite } from "~/queries/home-feed";
import { queryKeys } from "~/queries/keys";
import api from "~/services/api";

export function meta() {
	return [{ title: "Feed — VSBG Box" }];
}

export default function HomeFeedRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const [showCreate, setShowCreate] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const viewerEmail = useViewerEmail();
	const displayNames = useMemberDisplayNames();
	const avatarVersions = useAvatarVersionMap();
	const {
		data,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useHomeTopicsInfinite();
	const { data: config } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: 60_000,
	});
	const isAdmin = config?.isAdmin ?? false;
	const topics = data?.pages.flatMap((page) => page.topics) ?? [];
	const viewerName = viewerEmail
		? resolveMemberDisplayName(displayNames, viewerEmail)
		: "you";

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !hasNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: "240px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<Loader />
			</div>
		);
	}

	if (isError) {
		return (
			<Empty
				title="Could not load feed"
				description="Refresh the page or check your access."
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-kumo-default">Team feed</h1>
					<p className="text-sm text-kumo-subtle">
						Share updates, react, and comment with your team.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{isAdmin && (
						<Link to={`/mailbox/${mailboxId}/feed/manage`}>
							<Button variant="secondary" size="sm" icon={<GearIcon size={16} />}>
								Manage
							</Button>
						</Link>
					)}
					<Button
						variant="primary"
						size="sm"
						icon={<PlusIcon size={16} />}
						onClick={() => setShowCreate(true)}
					>
						Post
					</Button>
				</div>
			</div>

			<button
				type="button"
				onClick={() => setShowCreate(true)}
				className="flex w-full items-center gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 text-left shadow-sm transition-colors hover:bg-kumo-tint"
			>
				{viewerEmail ? (
					<MailboxAvatar
						email={viewerEmail}
						name={viewerName}
						size="md"
						variant="brand"
						avatarVersion={getAvatarVersion(avatarVersions, viewerEmail)}
					/>
				) : (
					<span className="size-9 rounded-full bg-kumo-fill" />
				)}
				<span className="text-sm text-kumo-subtle">
					What's on your mind, {viewerName}?
				</span>
			</button>

			{topics.length === 0 ? (
				<Empty
					title="No posts yet"
					description="Be the first to share something with the team."
				/>
			) : (
				<div className="space-y-3">
					{topics.map((topic) => (
						<TopicCard key={topic.id} topic={topic} />
					))}
				</div>
			)}

			<div ref={sentinelRef} className="flex justify-center py-4">
				{isFetchingNextPage && <Loader />}
				{!hasNextPage && topics.length > 0 && (
					<p className="text-xs text-kumo-subtle">You're all caught up.</p>
				)}
			</div>

			{showCreate && <CreateTopicSheet onClose={() => setShowCreate(false)} />}
		</div>
	);
}