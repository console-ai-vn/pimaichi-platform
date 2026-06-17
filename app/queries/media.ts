import {
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import api from "~/services/api";
import { queryKeys } from "./keys";

export function useStreamUploadUrl() {
	return useMutation({
		mutationFn: () => api.initStreamUpload(),
	})
}

export function useVideoStatus(videoId: string | undefined) {
	return useQuery({
		queryKey: ["media", "stream", videoId],
		queryFn: () => api.getStreamVideoStatus(videoId!),
		enabled: !!videoId,
		refetchInterval: (query) => {
			const state = query.state.data?.state
			if (!state || state === "ready" || state === "error") return false
			return 5000
		},
	})
}

export function useVideosList(mailboxId: string | undefined) {
	return useQuery({
		queryKey: ["media", "stream", "list", mailboxId],
		queryFn: () => api.listStreamVideos(mailboxId!),
		enabled: !!mailboxId,
	})
}

export function useDeleteVideo() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (videoId: string) => api.deleteStreamVideo(videoId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["media", "stream"] })
		},
	})
}

export function useImageUploadUrl() {
	return useMutation({
		mutationFn: () => api.initImagesUpload(),
	})
}

export function useImageVariants(imageId: string | undefined) {
	return useQuery({
		queryKey: ["media", "images", imageId],
		queryFn: () => api.getImageVariants(imageId!),
		enabled: !!imageId,
	})
}

export function useImagesList(mailboxId: string | undefined) {
	return useQuery({
		queryKey: ["media", "images", "list", mailboxId],
		queryFn: () => api.listImages(mailboxId!),
		enabled: !!mailboxId,
	})
}

export function useDeleteImage() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (imageId: string) => api.deleteMediaImage(imageId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["media", "images"] })
		},
	})
}

export function useR2Upload() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: async ({ file }: { file: File }) => {
			const formData = new FormData()
			formData.append("file", file)
			formData.append(
				"meta",
				JSON.stringify({
					filename: file.name,
					contentType: file.type || "application/octet-stream",
				}),
			)
			return api.uploadR2Media(formData)
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["media", "r2"] })
		},
	})
}

export function useSignedStreamToken(videoId: string | undefined) {
	return useQuery({
		queryKey: ["media", "stream", "token", videoId],
		queryFn: () => api.getSignedStreamToken(videoId!),
		enabled: !!videoId,
		staleTime: 300_000,
	})
}
