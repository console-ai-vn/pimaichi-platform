import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { HomeTopic } from "~/types";
import { queryKeys } from "./keys";

export function useHomeTopics(page = 1) {
	return useQuery({
		queryKey: queryKeys.home.topics(page),
		queryFn: () => api.listHomeTopics(page),
	});
}

export function useHomeTopic(topicId: string | undefined) {
	return useQuery({
		queryKey: topicId ? queryKeys.home.topic(topicId) : ["home", "topic", "_disabled"],
		queryFn: () => api.getHomeTopic(topicId!),
		enabled: !!topicId,
	});
}

export function useHomeComments(topicId: string | undefined) {
	return useQuery({
		queryKey: topicId
			? queryKeys.home.comments(topicId)
			: ["home", "comments", "_disabled"],
		queryFn: () => api.listHomeComments(topicId!),
		enabled: !!topicId,
	});
}

export function useCreateHomeTopic() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: api.createHomeTopic,
		onSuccess: () => {
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
			qc.invalidateQueries({ queryKey: ["home", "topics"] });
		},
	});
}

export function useSetHomeReaction(topicId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (reaction: "like" | "dislike" | null) =>
			api.setHomeReaction(topicId, reaction),
		onSuccess: (topic: HomeTopic) => {
			qc.setQueryData(queryKeys.home.topic(topicId), topic);
			qc.invalidateQueries({ queryKey: ["home", "topics"] });
		},
	});
}