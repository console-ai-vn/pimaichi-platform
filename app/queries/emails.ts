// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { ApiError } from "~/services/api";
import type { ContactProfile, ConversationEvent, ConversationState, Email, InternalNote } from "~/types";
import { queryKeys } from "./keys";

// ---------- Types ----------

interface EmailListResponse {
	emails: Email[];
	totalCount: number;
}

// ---------- Queries ----------

export function useEmails(
	mailboxId: string | undefined,
	params: Record<string, string>,
	options?: { enabled?: boolean; refetchInterval?: number },
) {
	const queryParams = params.folder
		? { ...params, threaded: "true" }
		: params;

	return useQuery<EmailListResponse>({
		queryKey: mailboxId
			? queryKeys.emails.list(mailboxId, queryParams)
			: ["emails", "_disabled"],
		queryFn: async () => {
			const data = await api.listEmails(mailboxId!, queryParams) as
				| EmailListResponse
				| Email[];
			if (data && typeof data === "object" && "emails" in data) {
				return {
					emails: (data as EmailListResponse).emails ?? [],
					totalCount: (data as EmailListResponse).totalCount ?? 0,
				};
			}
			const arr = Array.isArray(data) ? data : [];
			return { emails: arr, totalCount: arr.length };
		},
		enabled: !!mailboxId && (options?.enabled ?? true),
		refetchInterval: options?.refetchInterval,
	});
}

export function useEmail(
	mailboxId: string | undefined,
	emailId: string | undefined,
) {
	return useQuery<Email>({
		queryKey: mailboxId && emailId
			? queryKeys.emails.detail(mailboxId, emailId)
			: ["emails", "_disabled_detail"],
		queryFn: () => api.getEmail(mailboxId!, emailId!) as Promise<Email>,
		enabled: !!mailboxId && !!emailId,
	});
}

export function useThreadReplies(
	mailboxId: string | undefined,
	threadId: string | undefined | null,
) {
	const qc = useQueryClient();

	return useQuery<Email[]>({
		queryKey: mailboxId && threadId
			? queryKeys.emails.thread(mailboxId, threadId)
			: ["emails", "_disabled_thread"],
		queryFn: async ({ signal }) => {
			// Single request returns all thread emails with full bodies +
			// attachments. Eliminates the previous N+1 pattern that fired
			// a separate getEmail call per thread message.
			const emails = await api.getThread(mailboxId!, threadId!, { signal }) as Email[];

			// Populate individual email detail caches so clicking a thread
			// message in the panel doesn't re-fetch.
			for (const email of emails) {
				qc.setQueryData(
					queryKeys.emails.detail(mailboxId!, email.id),
					email,
				);
			}

			return emails;
		},
		enabled: !!mailboxId && !!threadId,
	});
}

export function useConversationState(
	mailboxId: string | undefined,
	threadId: string | undefined | null,
) {
	return useQuery<ConversationState>({
		queryKey: mailboxId && threadId
			? queryKeys.emails.conversationState(mailboxId, threadId)
			: ["emails", "_disabled_conversation_state"],
		queryFn: () => api.getConversationState(mailboxId!, threadId!),
		enabled: !!mailboxId && !!threadId,
	});
}

export function useInternalNotes(
	mailboxId: string | undefined,
	threadId: string | undefined | null,
) {
	return useQuery<InternalNote[]>({
		queryKey: mailboxId && threadId
			? queryKeys.emails.internalNotes(mailboxId, threadId)
			: ["emails", "_disabled_internal_notes"],
		queryFn: () => api.listInternalNotes(mailboxId!, threadId!),
		enabled: !!mailboxId && !!threadId,
	});
}

export function useConversationEvents(
	mailboxId: string | undefined,
	threadId: string | undefined | null,
) {
	return useQuery<ConversationEvent[]>({
		queryKey: mailboxId && threadId
			? queryKeys.emails.conversationEvents(mailboxId, threadId)
			: ["emails", "_disabled_conversation_events"],
		queryFn: () => api.listConversationEvents(mailboxId!, threadId!),
		enabled: !!mailboxId && !!threadId,
	});
}

export function useContactProfile(
	mailboxId: string | undefined,
	emailAddress: string | undefined | null,
) {
	return useQuery<ContactProfile | null>({
		queryKey: mailboxId && emailAddress
			? queryKeys.emails.contactProfile(mailboxId, emailAddress)
			: ["emails", "_disabled_contact_profile"],
		queryFn: async () => {
			try {
				return await api.getContactProfile(mailboxId!, emailAddress!);
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) return null;
				throw error;
			}
		},
		enabled: !!mailboxId && !!emailAddress,
	});
}

// ---------- Mutations ----------

/** Invalidate both the email list and folder counts after any email mutation. */
function useInvalidateEmailData() {
	const qc = useQueryClient();
	return (mailboxId: string) => {
		qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
		qc.invalidateQueries({
			queryKey: queryKeys.folders.list(mailboxId),
		});
	};
}

export function useSendEmail() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			email,
		}: { mailboxId: string; email: unknown }) =>
			api.sendEmail(mailboxId, email),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useUpdateEmail() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			id,
			data,
		}: { mailboxId: string; id: string; data: unknown }) =>
			api.updateEmail(mailboxId, id, data),
		onMutate: async ({ mailboxId, id, data }) => {
			// Only target list queries (3rd key element is an object = params),
			// NOT detail queries (string = emailId) or thread queries.
			const isListQuery = (query: { queryKey: readonly unknown[] }) =>
				query.queryKey[0] === "emails" &&
				query.queryKey[1] === mailboxId &&
				typeof query.queryKey[2] === "object" &&
				query.queryKey[2] !== null;

			// Cancel in-flight list queries so they don't overwrite our optimistic update
			await qc.cancelQueries({
				queryKey: ["emails", mailboxId],
				predicate: isListQuery,
			});

			// Snapshot current email list caches for rollback
			const listQueries = qc.getQueriesData<{ emails: Email[]; totalCount: number }>({
				queryKey: ["emails", mailboxId],
				predicate: isListQuery,
			});

			// Optimistically patch every cached email list that contains this email
			for (const [key, cached] of listQueries) {
				if (!cached?.emails) continue;
				qc.setQueryData(key, {
					...cached,
					emails: cached.emails.map((e) =>
						e.id === id ? { ...e, ...(data as Partial<Email>) } : e,
					),
				});
			}

			// Also patch the detail cache
			const detailKey = queryKeys.emails.detail(mailboxId, id);
			const prevDetail = qc.getQueryData<Email>(detailKey);
			if (prevDetail) {
				qc.setQueryData(detailKey, { ...prevDetail, ...(data as Partial<Email>) });
			}

			return { listQueries, prevDetail, detailKey };
		},
		onError: (_err, _vars, context) => {
			// Roll back optimistic updates on failure
			if (context?.listQueries) {
				for (const [key, cached] of context.listQueries) {
					qc.setQueryData(key, cached);
				}
			}
			if (context?.prevDetail) {
				qc.setQueryData(context.detailKey, context.prevDetail);
			}
		},
		onSettled: (_data, _err, { mailboxId }) => {
			// Always refetch to ensure server truth
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
			qc.invalidateQueries({
				queryKey: queryKeys.folders.list(mailboxId),
			});
		},
	});
}

export function useMarkThreadRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			threadId,
		}: { mailboxId: string; threadId: string }) =>
			api.markThreadRead(mailboxId, threadId),
		onSuccess: (_data, { mailboxId }) => {
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
			qc.invalidateQueries({
				queryKey: queryKeys.folders.list(mailboxId),
			});
		},
	});
}

export function useUpdateConversationState() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			threadId,
			state,
		}: { mailboxId: string; threadId: string; state: Partial<ConversationState> }) =>
			api.updateConversationState(mailboxId, threadId, state),
		onSuccess: (_data, { mailboxId, threadId }) => {
			qc.invalidateQueries({
				queryKey: queryKeys.emails.conversationState(mailboxId, threadId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.emails.conversationEvents(mailboxId, threadId),
			});
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
		},
	});
}

export function useCreateInternalNote() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			threadId,
			body,
		}: { mailboxId: string; threadId: string; body: string }) =>
			api.createInternalNote(mailboxId, threadId, body),
		onSuccess: (_data, { mailboxId, threadId }) => {
			qc.invalidateQueries({
				queryKey: queryKeys.emails.internalNotes(mailboxId, threadId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.emails.conversationEvents(mailboxId, threadId),
			});
		},
	});
}

export function useUpdateContactProfile() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			emailAddress,
			profile,
		}: { mailboxId: string; emailAddress: string; profile: Partial<ContactProfile> }) =>
			api.updateContactProfile(mailboxId, emailAddress, profile),
		onSuccess: (_data, { mailboxId, emailAddress }) => {
			qc.invalidateQueries({
				queryKey: queryKeys.emails.contactProfile(mailboxId, emailAddress),
			});
		},
	});
}

export function useDeleteEmail() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			id,
		}: { mailboxId: string; id: string }) =>
			api.deleteEmail(mailboxId, id),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useDeleteThread() {
	const qc = useQueryClient();
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			threadId,
		}: { mailboxId: string; threadId: string }) =>
			api.deleteThread(mailboxId, threadId),
		onSuccess: (_data, { mailboxId, threadId }) => {
			invalidate(mailboxId);
			qc.removeQueries({
				queryKey: queryKeys.emails.thread(mailboxId, threadId),
			});
			qc.removeQueries({
				queryKey: queryKeys.emails.conversationState(mailboxId, threadId),
			});
		},
	});
}

export function useMoveThread() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			threadId,
			folderId,
		}: { mailboxId: string; threadId: string; folderId: string }) =>
			api.moveThread(mailboxId, threadId, folderId),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useMoveEmail() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			id,
			folderId,
		}: { mailboxId: string; id: string; folderId: string }) =>
			api.moveEmail(mailboxId, id, folderId),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useSaveDraft() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			draft,
		}: {
			mailboxId: string;
			draft: {
				to?: string;
				cc?: string;
				bcc?: string;
				subject?: string;
				body: string;
				in_reply_to?: string;
				thread_id?: string;
				draft_id?: string;
			};
		}) => api.saveDraft(mailboxId, draft),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useReplyToEmail() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			emailId,
			email,
		}: { mailboxId: string; emailId: string; email: unknown }) =>
			api.replyToEmail(mailboxId, emailId, email),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}

export function useForwardEmail() {
	const invalidate = useInvalidateEmailData();
	return useMutation({
		mutationFn: ({
			mailboxId,
			emailId,
			email,
		}: { mailboxId: string; emailId: string; email: unknown }) =>
			api.forwardEmail(mailboxId, emailId, email),
		onSuccess: (_data, { mailboxId }) => invalidate(mailboxId),
	});
}
