import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import api from "~/services/api";
import type { HomeTopic, HomeTopicListResponse } from "~/types";
import { queryKeys } from "./keys";

const TOPICS_INFINITE_KEY = ["home", "topics", "infinite"] as const;

function patchTopicInPages(
	pages: HomeTopicListResponse[] | undefined,
	topicId: string,
	patch: (topic: HomeTopic) => HomeTopic,
) {
	if (!pages) return pages;
	return pages.map((page) => ({
		...page,
		topics: page.topics.map((topic) =>
			topic.id === topicId ? patch(topic) : topic,
		),
	}));
}

function applyReactionPatch(topic: HomeTopic, reaction: "like" | "dislike" | null) {
	let likeCount = topic.likeCount;
	let dislikeCount = topic.dislikeCount;
	const prev = topic.userReaction;

	if (prev === "like") likeCount = Math.max(0, likeCount - 1);
	if (prev === "dislike") dislikeCount = Math.max(0, dislikeCount - 1);
	if (reaction === "like") likeCount += 1;
	if (reaction === "dislike") dislikeCount += 1;

	return {
		...topic,
		likeCount,
		dislikeCount,
		userReaction: reaction,
	};
}

export function useHomeTopicsInfinite(limit = 20) {
	return useInfiniteQuery({
		queryKey: [...TOPICS_INFINITE_KEY, limit],
		queryFn: ({ pageParam }) => api.listHomeTopics(pageParam, limit),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const loaded = lastPage.page * lastPage.limit;
			return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
		},
	});
}

export function useHomeTopics(page = 1, limit = 20) {
	return useQuery({
		queryKey: queryKeys.home.topics(page, limit),
		queryFn: () => api.listHomeTopics(page, limit),
	});
}

export function useHomeTopic(topicId: string | undefined) {
	return useQuery({
		queryKey: topicId ? queryKeys.home.topic(topicId) : ["home", "topic", "_disabled"],
		queryFn: () => api.getHomeTopic(topicId!),
		enabled: !!topicId,
	});
}

export function useHomeCommentsInfinite(topicId: string | undefined, limit = 50) {
	return useInfiniteQuery({
		queryKey: topicId
			? [...queryKeys.home.comments(topicId), "infinite", limit]
			: ["home", "comments", "_disabled"],
		queryFn: ({ pageParam }) => api.listHomeComments(topicId!, pageParam, limit),
		initialPageParam: 1,
		enabled: !!topicId,
		getNextPageParam: (lastPage) => {
			const loaded = lastPage.page * lastPage.limit;
			return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
		},
	});
}

export function useCreateHomeTopic() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: api.createHomeTopic,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: TOPICS_INFINITE_KEY });
			qc.invalidateQueries({ queryKey: ["home", "topics"] });
		},
	});
}

export function useCreateHomeComment(topicId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (payload: {
			body: string;
			images?: Array<{ content: string; type: string }>;
		}) => api.createHomeComment(topicId, payload),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.home.topic(topicId) });
			qc.invalidateQueries({ queryKey: queryKeys.home.comments(topicId) });
			qc.invalidateQueries({ queryKey: TOPICS_INFINITE_KEY });
		},
	});
}

export function useSetHomeReaction(topicId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (reaction: "like" | "dislike" | null) =>
			api.setHomeReaction(topicId, reaction),
		onMutate: async (reaction) => {
			await qc.cancelQueries({ queryKey: queryKeys.home.topic(topicId) });
			const previousTopic = qc.getQueryData<HomeTopic>(queryKeys.home.topic(topicId));
			const previousPages = qc.getQueriesData<{ pages: HomeTopicListResponse[] }>({
				queryKey: TOPICS_INFINITE_KEY,
			});

			const patch = (topic: HomeTopic) => applyReactionPatch(topic, reaction);
			if (previousTopic) {
				qc.setQueryData(queryKeys.home.topic(topicId), patch(previousTopic));
			}

			for (const [key, data] of previousPages) {
				if (!data?.pages) continue;
				qc.setQueryData(key, {
					...data,
					pages: patchTopicInPages(data.pages, topicId, patch),
				});
			}

			return { previousTopic, previousPages };
		},
		onError: (_error, _reaction, context) => {
			if (context?.previousTopic) {
				qc.setQueryData(queryKeys.home.topic(topicId), context.previousTopic);
			}
			for (const [key, data] of context?.previousPages ?? []) {
				qc.setQueryData(key, data);
			}
		},
		onSuccess: (topic: HomeTopic) => {
			qc.setQueryData(queryKeys.home.topic(topicId), topic);
			const pages = qc.getQueriesData<{ pages: HomeTopicListResponse[] }>({
				queryKey: TOPICS_INFINITE_KEY,
			});
			for (const [key, data] of pages) {
				if (!data?.pages) continue;
				qc.setQueryData(key, {
					...data,
					pages: patchTopicInPages(data.pages, topicId, () => topic),
				});
			}
		},
	});
}

export function useDeleteHomeTopic() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (topicId: string) => api.deleteHomeTopic(topicId),
		onSuccess: (_data, topicId) => {
			qc.removeQueries({ queryKey: queryKeys.home.topic(topicId) });
			qc.removeQueries({ queryKey: queryKeys.home.comments(topicId) });
			qc.invalidateQueries({ queryKey: TOPICS_INFINITE_KEY });
			qc.invalidateQueries({ queryKey: ["home", "topics"] });
		},
	});
}

export function useDeleteHomeComment(topicId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (commentId: string) =>
			api.deleteHomeComment(topicId, commentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.home.topic(topicId) });
			qc.invalidateQueries({ queryKey: queryKeys.home.comments(topicId) });
			qc.invalidateQueries({ queryKey: TOPICS_INFINITE_KEY });
		},
	});
}