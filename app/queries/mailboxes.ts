// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { Mailbox } from "~/types";
import { queryKeys } from "./keys";

export function useMailboxes() {
	return useQuery<Mailbox[]>({
		queryKey: queryKeys.mailboxes.all,
		queryFn: () => api.listMailboxes() as Promise<Mailbox[]>,
	});
}

export function useMailbox(mailboxId: string | undefined) {
	return useQuery<Mailbox>({
		queryKey: mailboxId
			? queryKeys.mailboxes.detail(mailboxId)
			: ["mailboxes", "_disabled"],
		queryFn: () => api.getMailbox(mailboxId!) as Promise<Mailbox>,
		enabled: !!mailboxId,
	});
}

export function useCreateMailbox() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			email,
			name,
			settings,
		}: {
			email: string;
			name: string;
			settings?: Mailbox["settings"];
		}) => api.createMailbox(email, name, settings),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
			qc.invalidateQueries({ queryKey: queryKeys.boards.all });
		},
	});
}

export function useUpdateMailbox() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			settings,
		}: { mailboxId: string; settings: unknown }) =>
			api.updateMailbox(mailboxId, settings),
		onSuccess: (_data, { mailboxId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(mailboxId) });
			qc.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
			qc.invalidateQueries({ queryKey: queryKeys.boards.all });
		},
	});
}

function uploadMailboxImage<T>(
	mailboxId: string,
	file: File,
	upload: (mailboxId: string, payload: { content: string; type: string }) => Promise<T>,
) {
	return new Promise<T>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = async () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new Error("Failed to read image"));
				return;
			}
			const base64 = result.split(",")[1];
			if (!base64) {
				reject(new Error("Failed to read image"));
				return;
			}
			try {
				resolve(await upload(mailboxId, { content: base64, type: file.type }));
			} catch (error) {
				reject(error);
			}
		};
		reader.onerror = () => reject(new Error("Failed to read image"));
		reader.readAsDataURL(file);
	});
}

function useInvalidateMailboxImages() {
	const qc = useQueryClient();
	return (mailboxId: string) => {
		qc.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(mailboxId) });
		qc.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
	};
}

export function useUploadMailboxAvatar() {
	const invalidate = useInvalidateMailboxImages();
	return useMutation({
		mutationFn: ({ mailboxId, file }: { mailboxId: string; file: File }) =>
			uploadMailboxImage(mailboxId, file, api.uploadMailboxAvatar),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useUploadMailboxCover() {
	const invalidate = useInvalidateMailboxImages();
	return useMutation({
		mutationFn: ({ mailboxId, file }: { mailboxId: string; file: File }) =>
			uploadMailboxImage(mailboxId, file, api.uploadMailboxCover),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useDeleteMailbox() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (mailboxId: string) => api.deleteMailbox(mailboxId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
		},
	});
}
