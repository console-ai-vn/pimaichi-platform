// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type {
	ContactProfile,
	ConversationEvent,
	ConversationState,
	Email,
	Folder,
	ForumBoard,
	HomeComment,
	HomeCommentListResponse,
	HomeTopic,
	HomeTopicListResponse,
	InternalNote,
	Mailbox,
	PaymentInvoice,
	PaymentSubscription,
} from "~/types";

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
	status: number;
	body: Record<string, unknown>;

	constructor(status: number, body: Record<string, unknown>) {
		super((body.error as string) || `Request failed: ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	}
}

async function request<T>(
	url: string,
	options: RequestInit = {},
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	// Combine caller signal (e.g. TanStack Query abort) with our timeout signal
	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;

	try {
		const res = await fetch(url, {
			...options,
			signal,
			headers: {
				"Content-Type": "application/json",
				...(options.headers as Record<string, string>),
			},
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new ApiError(res.status, body as Record<string, unknown>);
		}

		if (res.status === 204) return undefined as T;

		const contentType = res.headers.get("content-type") ?? "";
		if (contentType.includes("application/json")) {
			return res.json() as Promise<T>;
		}
		return res.blob() as unknown as T;
	} finally {
		clearTimeout(timeout);
	}
}

function get<T>(url: string, opts?: { params?: Record<string, string>; responseType?: string; signal?: AbortSignal }) {
	const query = opts?.params ? `?${new URLSearchParams(opts.params)}` : "";
	return request<T>(`${url}${query}`, {
		method: "GET",
		signal: opts?.signal,
		...(opts?.responseType === "blob" ? { headers: { Accept: "*/*" } } : {}),
	});
}

function post<T>(url: string, body?: unknown, opts?: { signal?: AbortSignal }) {
	return request<T>(url, {
		method: "POST",
		signal: opts?.signal,
		body: body != null ? JSON.stringify(body) : undefined,
	});
}

function put<T>(url: string, body?: unknown) {
	return request<T>(url, {
		method: "PUT",
		body: body != null ? JSON.stringify(body) : undefined,
	});
}

function patch<T>(url: string, body?: unknown) {
	return request<T>(url, {
		method: "PATCH",
		body: body != null ? JSON.stringify(body) : undefined,
	});
}

function del<T>(url: string) {
	return request<T>(url, { method: "DELETE" });
}

// ---------- Typed response shapes ----------

interface EmailListResponse {
	emails: Email[];
	totalCount: number;
}

// ---------- API client ----------

const api = {
	// Config
	getConfig: () =>
		get<{
			domains: string[];
			emailAddresses: string[];
			accessEmail: string | null;
			isAdmin: boolean;
		}>("/api/v1/config"),

	// Boards
	listBoards: () => get<ForumBoard[]>("/api/v1/boards"),

	// Mailboxes
	listMailboxes: () => get<Mailbox[]>("/api/v1/mailboxes"),
	createMailbox: (email: string, name: string, settings?: unknown) =>
		post<Mailbox>("/api/v1/mailboxes", { email, name, settings }),
	getMailbox: (mailboxId: string) =>
		get<Mailbox>(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`),
	updateMailbox: (mailboxId: string, settings: unknown) =>
		put<Mailbox>(`/api/v1/mailboxes/${mailboxId}`, { settings }),
	uploadMailboxAvatar: (
		mailboxId: string,
		payload: { content: string; type: string },
	) =>
		put<{ avatarUpdatedAt: string }>(
			`/api/v1/mailboxes/${mailboxId}/avatar`,
			payload,
		),
	uploadMailboxCover: (
		mailboxId: string,
		payload: { content: string; type: string },
	) =>
		put<{ coverUpdatedAt: string }>(
			`/api/v1/mailboxes/${mailboxId}/cover`,
			payload,
		),
	deleteMailbox: (mailboxId: string) =>
		del<void>(`/api/v1/mailboxes/${mailboxId}`),

	// Emails
	listEmails: (mailboxId: string, params: Record<string, string>, opts?: { signal?: AbortSignal }) =>
		get<EmailListResponse | Email[]>(`/api/v1/mailboxes/${mailboxId}/emails`, { params, signal: opts?.signal }),
	sendEmail: (mailboxId: string, email: unknown) =>
		post<void>(`/api/v1/mailboxes/${mailboxId}/emails`, email),
	getEmail: (mailboxId: string, id: string, opts?: { signal?: AbortSignal }) =>
		get<Email>(`/api/v1/mailboxes/${mailboxId}/emails/${id}`, { signal: opts?.signal }),
	updateEmail: (mailboxId: string, id: string, data: unknown) =>
		put<Email>(`/api/v1/mailboxes/${mailboxId}/emails/${id}`, data),
	deleteEmail: (mailboxId: string, id: string) =>
		del<void>(`/api/v1/mailboxes/${mailboxId}/emails/${id}`),
	moveEmail: (mailboxId: string, id: string, folderId: string) =>
		post<void>(`/api/v1/mailboxes/${mailboxId}/emails/${id}/move`, { folderId }),
	getThread: (mailboxId: string, threadId: string, opts?: { signal?: AbortSignal }) =>
		get<Email[]>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}`, { signal: opts?.signal }),
	markThreadRead: (mailboxId: string, threadId: string) =>
		post<void>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/read`),
	deleteThread: (mailboxId: string, threadId: string) =>
		del<void>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}`),
	moveThread: (mailboxId: string, threadId: string, folderId: string) =>
		post<{ status: string; threadId: string; movedCount: number; folderId: string }>(
			`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/move`,
			{ folderId },
		),
	getConversationState: (mailboxId: string, threadId: string) =>
		get<ConversationState>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/state`),
	updateConversationState: (mailboxId: string, threadId: string, state: unknown) =>
		patch<ConversationState>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/state`, state),
	listInternalNotes: (mailboxId: string, threadId: string) =>
		get<InternalNote[]>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/notes`),
	createInternalNote: (mailboxId: string, threadId: string, body: string) =>
		post<InternalNote>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/notes`, { body }),
	listConversationEvents: (mailboxId: string, threadId: string) =>
		get<ConversationEvent[]>(`/api/v1/mailboxes/${mailboxId}/threads/${threadId}/events`),
	getContactProfile: (mailboxId: string, emailAddress: string) =>
		get<ContactProfile>(`/api/v1/mailboxes/${mailboxId}/contacts/${encodeURIComponent(emailAddress)}`),
	updateContactProfile: (mailboxId: string, emailAddress: string, profile: Partial<ContactProfile>) =>
		patch<ContactProfile>(`/api/v1/mailboxes/${mailboxId}/contacts/${encodeURIComponent(emailAddress)}`, profile),
	getAttachment: (mailboxId: string, emailId: string, attachmentId: string) =>
		get<Blob>(`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachmentId}`, { responseType: "blob" }),
	saveDraft: (
		mailboxId: string,
		draft: {
			to?: string;
			cc?: string;
			bcc?: string;
			subject?: string;
			body: string;
			in_reply_to?: string;
			thread_id?: string;
			draft_id?: string;
		},
	) => post<{ draft_id: string }>(`/api/v1/mailboxes/${mailboxId}/drafts`, draft),
	replyToEmail: (mailboxId: string, emailId: string, email: unknown) =>
		post<void>(`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/reply`, email),
	forwardEmail: (mailboxId: string, emailId: string, email: unknown) =>
		post<void>(`/api/v1/mailboxes/${mailboxId}/emails/${emailId}/forward`, email),

	// Folders
	listFolders: (mailboxId: string) =>
		get<Folder[]>(`/api/v1/mailboxes/${mailboxId}/folders`),
	createFolder: (mailboxId: string, name: string) =>
		post<Folder>(`/api/v1/mailboxes/${mailboxId}/folders`, { name }),
	updateFolder: (mailboxId: string, id: string, name: string) =>
		put<Folder>(`/api/v1/mailboxes/${mailboxId}/folders/${id}`, { name }),
	deleteFolder: (mailboxId: string, id: string) =>
		del<void>(`/api/v1/mailboxes/${mailboxId}/folders/${id}`),

	// Search
	searchEmails: (mailboxId: string, params: Record<string, string>) =>
		get<EmailListResponse | Email[]>(`/api/v1/mailboxes/${mailboxId}/search`, { params }),

	// Admin
	listAuditLog: (mailboxId: string, params: Record<string, string>) =>
		get<{
			entries: Array<{
				id: string;
				actor_email: string;
				action: string;
				target_type: string;
				target_id: string;
				payload: Record<string, unknown> | null;
				created_at: string;
			}>;
			totalCount: number;
			page: number;
			limit: number;
		}>(`/api/v1/mailboxes/${mailboxId}/audit`, { params }),
	getRetentionStats: (mailboxId: string) =>
		get<{
			trashTotal: number;
			sentTotal: number;
			trashEligible: number;
			sentEligible: number;
			trashCutoff: string;
			sentCutoff: string;
		}>(`/api/v1/mailboxes/${mailboxId}/retention/stats`),
	runRetention: (
		mailboxId: string,
		policy?: { trashDays?: number; sentDays?: number },
	) =>
		post<{
			purgedCount: number;
			archivedCount: number;
			purgedEmailIds: string[];
			archivedEmailIds: string[];
			stats: {
				trashTotal: number;
				sentTotal: number;
				trashEligible: number;
				sentEligible: number;
				trashCutoff: string;
				sentCutoff: string;
				trashDays: number;
				sentDays: number;
				testMode: boolean;
			};
		}>(`/api/v1/mailboxes/${mailboxId}/retention/run`, policy ?? {}),

	getAdminDomains: () =>
		get<{
			domains: string[];
			emailAddresses: string[];
			accessEmailAddresses: string[];
		}>("/api/v1/admin/domains"),
	updateAdminDomains: (config: {
		domains?: string[];
		emailAddresses?: string[];
		accessEmailAddresses?: string[];
	}) => put<{
		domains: string[];
		emailAddresses: string[];
		accessEmailAddresses: string[];
	}>("/api/v1/admin/domains", config),
	listSignupRequests: () =>
		get<{
			requests: Array<{
				id: string;
				status: "pending" | "approved" | "rejected";
				createdAt: string;
				displayName: string;
				personalEmail: string;
				desiredMailbox: string;
				note: string;
				approvedAt?: string;
				approvedBy?: string;
				adminNote?: string;
				rejectedAt?: string;
				rejectedBy?: string;
			}>;
			automation: {
				ready: boolean;
				hasApiToken: boolean;
				accountId: string;
				listId: string;
			};
		}>("/api/v1/admin/signup-requests"),
	updateSignupAutomation: (payload: { cfAccountId: string; accessOtpListId: string }) =>
		put<{
			ready: boolean;
			hasApiToken: boolean;
			accountId: string;
			listId: string;
		}>("/api/v1/admin/signup-automation", payload),
	approveSignupRequest: (requestId: string) =>
		post<{
			request: {
				id: string;
				status: "pending" | "approved" | "rejected";
				createdAt: string;
				displayName: string;
				personalEmail: string;
				desiredMailbox: string;
				note: string;
				approvedAt?: string;
				approvedBy?: string;
				adminNote?: string;
			};
			mailboxCreated: boolean;
			permissionGranted: boolean;
			accessOtpAdded: boolean;
			accessOtpSkipped: boolean;
			accessOtpError?: string;
			notificationSent: boolean;
			notificationError?: string;
			fullyAutomated: boolean;
		}>(`/api/v1/admin/signup-requests/${encodeURIComponent(requestId)}/approve`, {}),
	rejectSignupRequest: (requestId: string) =>
		post<{
			request: {
				id: string;
				status: "pending" | "approved" | "rejected";
				createdAt: string;
				displayName: string;
				personalEmail: string;
				desiredMailbox: string;
				note: string;
				rejectedAt?: string;
				rejectedBy?: string;
				adminNote?: string;
			};
		}>(`/api/v1/admin/signup-requests/${encodeURIComponent(requestId)}/reject`, {}),
	listMailboxPermissions: (mailboxId: string) =>
		get<Array<{
			user_email: string;
			role: string;
			granted_by: string;
			granted_at: string;
		}>>(`/api/v1/mailboxes/${mailboxId}/permissions`),
	grantMailboxPermission: (
		mailboxId: string,
		payload: { userEmail: string; role: "manager" | "member" | "viewer" },
	) => post(`/api/v1/mailboxes/${mailboxId}/permissions`, payload),
	revokeMailboxPermission: (mailboxId: string, userEmail: string) =>
		del<void>(`/api/v1/mailboxes/${mailboxId}/permissions/${encodeURIComponent(userEmail)}`),

	// Home feed
	listHomeTopics: (page = 1, limit = 20) =>
		get<HomeTopicListResponse>("/api/v1/home/topics", {
			params: { page: String(page), limit: String(limit) },
		}),
	getHomeTopic: (topicId: string) =>
		get<HomeTopic>(`/api/v1/home/topics/${encodeURIComponent(topicId)}`),
	createHomeTopic: (payload: {
		title: string;
		body: string;
		images?: Array<{ content: string; type: string }>;
	}) => post<HomeTopic>("/api/v1/home/topics", payload),
	listHomeComments: (topicId: string, page = 1, limit = 50) =>
		get<HomeCommentListResponse>(
			`/api/v1/home/topics/${encodeURIComponent(topicId)}/comments`,
			{ params: { page: String(page), limit: String(limit) } },
		),
	createHomeComment: (
		topicId: string,
		payload: {
			body: string;
			images?: Array<{ content: string; type: string }>;
		},
	) =>
		post<HomeComment>(
			`/api/v1/home/topics/${encodeURIComponent(topicId)}/comments`,
			payload,
		),
	setHomeReaction: (
		topicId: string,
		reaction: "like" | "dislike" | null,
	) =>
		put<HomeTopic>(
			`/api/v1/home/topics/${encodeURIComponent(topicId)}/reaction`,
			{ reaction },
		),
	deleteHomeTopic: (topicId: string) =>
		del<void>(`/api/v1/home/topics/${encodeURIComponent(topicId)}`),
	deleteHomeComment: (topicId: string, commentId: string) =>
		del<{ topicId: string; commentId: string }>(
			`/api/v1/home/topics/${encodeURIComponent(topicId)}/comments/${encodeURIComponent(commentId)}`,
		),
	homeTopicImageUrl: (topicId: string, imageId: string) =>
		`/api/v1/home/topics/${encodeURIComponent(topicId)}/images/${encodeURIComponent(imageId)}`,
	homeCommentImageUrl: (commentId: string, imageId: string) =>
		`/api/v1/home/comments/${encodeURIComponent(commentId)}/images/${encodeURIComponent(imageId)}`,

	// Payments
	checkout: (payload: { mailboxId: string; tier: string }) =>
		post<{
			subscription: PaymentSubscription
			invoice: PaymentInvoice
			qrCode: string
			amount: number
			tier: string
		}>("/api/v1/payments/checkout", payload),
	getInvoice: (invoiceId: string, mailboxId: string) =>
		get<{
			invoice: PaymentInvoice
			subscription: PaymentSubscription | null
		}>(`/api/v1/payments/invoice/${encodeURIComponent(invoiceId)}?mailboxId=${encodeURIComponent(mailboxId)}`),
	getSubscription: (mailboxId: string) =>
		get<{ subscription: PaymentSubscription | null }>(
			`/api/v1/payments/subscription/${encodeURIComponent(mailboxId)}`,
		),
	cancelSubscription: (mailboxId: string) =>
		post<{ subscription: PaymentSubscription | null }>(
			`/api/v1/payments/subscription/${encodeURIComponent(mailboxId)}/cancel`,
		),
	getInvoices: (mailboxId: string) =>
		get<{ invoices: PaymentInvoice[] }>(
			`/api/v1/payments/invoices/${encodeURIComponent(mailboxId)}`,
		),

	// Media
	initStreamUpload: () =>
		post<{ uploadURL: string; uid: string }>("/api/v1/media/upload/stream/init"),
	getStreamVideoStatus: (videoId: string) =>
		get<{
			state: string;
			playback: { hls: string; dash: string };
			thumbnail: string;
			duration: number;
		}>(`/api/v1/media/stream/${encodeURIComponent(videoId)}/status`),
	deleteStreamVideo: (videoId: string) =>
		del<void>(`/api/v1/media/stream/${encodeURIComponent(videoId)}`),
	listStreamVideos: (mailboxId: string) =>
		get<
			Array<{
				uid: string;
				thumbnail: string;
				status: { state: string };
				duration: number;
				created: string;
			}>
		>(`/api/v1/media/stream/list/${encodeURIComponent(mailboxId)}`),
	initImagesUpload: () =>
		post<{ uploadURL: string; id: string }>("/api/v1/media/upload/images/init"),
	getImageVariants: (imageId: string) =>
		get<{
			original: string;
			thumbnail: string;
			medium: string;
			full: string;
		}>(`/api/v1/media/images/${encodeURIComponent(imageId)}/variants`),
	deleteMediaImage: (imageId: string) =>
		del<void>(`/api/v1/media/images/${encodeURIComponent(imageId)}`),
	listImages: (mailboxId: string) =>
		get<
			Array<{
				id: string;
				variants: string[];
				uploaded: string;
			}>
		>(`/api/v1/media/images/list/${encodeURIComponent(mailboxId)}`),
	uploadR2Media: (formData: FormData) =>
		request<{ key: string; url: string; filename: string }>(
			"/api/v1/media/upload/r2",
			{
				method: "POST",
				body: formData,
				headers: {} as Record<string, string>,
			},
		),
	getSignedStreamToken: (videoId: string, expirySeconds = 3600) =>
		get<{ token: string }>(
			`/api/v1/media/signed-stream/${encodeURIComponent(videoId)}?expiry=${expirySeconds}`,
		),

	// Inventory
	getCatalog: (creatorMailboxId?: string) =>
		get<{ items: Array<{
			id: string
			creatorMailboxId: string
			type: string
			name: string
			description: string
			price: number
			imageUrl: string | null
			active: boolean
			createdAt: string
			updatedAt: string
		}> }>(
			creatorMailboxId
				? `/api/v1/inventory/catalog/${encodeURIComponent(creatorMailboxId)}`
				: "/api/v1/inventory/catalog",
		),
	createCatalogItem: (params: {
		creatorMailboxId: string
		type: string
		name: string
		description: string
		price: number
		imageUrl?: string
	}) =>
		post<{ item: Record<string, unknown> }>("/api/v1/inventory/catalog", params),
	updateCatalogItem: (itemId: string, params: {
		type?: string
		name?: string
		description?: string
		price?: number
		imageUrl?: string
	}) =>
		patch<{ item: Record<string, unknown> }>(
			`/api/v1/inventory/catalog/${encodeURIComponent(itemId)}`,
			params,
		),
	purchaseItem: (params: { userEmail: string; itemId: string }) =>
		post<{
			inventoryEntry: Record<string, unknown>
			subscription: Record<string, unknown>
			invoice: Record<string, unknown>
			item: Record<string, unknown>
		}>("/api/v1/inventory/purchase", params),
	getUserItems: (userEmail: string) =>
		get<{ items: Array<Record<string, unknown>> }>(
			`/api/v1/inventory/inventory/${encodeURIComponent(userEmail)}`,
		),
	consumeItem: (params: {
		userEmail: string
		itemId: string
		resourceType: string
		resourceId: string
	}) =>
		post<{ success: boolean }>("/api/v1/inventory/consume", params),
	getPurchaseHistory: (userEmail: string) =>
		get<{ history: Array<Record<string, unknown>> }>(
			`/api/v1/inventory/history/${encodeURIComponent(userEmail)}`,
		),

	// Gate
	checkGate: (mailboxId: string, emailId: string) =>
		get<{
			allowed: boolean
			tier: string
			reason?: string
			keyPrice?: number
			requiresSubscription: boolean
			alreadyUnlocked: boolean
		}>(`/api/v1/gate/check/${encodeURIComponent(mailboxId)}/${encodeURIComponent(emailId)}`),
	unlockGate: (mailboxId: string, emailId: string, itemId: string) =>
		post<{ success: boolean; error?: string }>(
			`/api/v1/gate/unlock/${encodeURIComponent(mailboxId)}/${encodeURIComponent(emailId)}`,
			{ itemId },
		),
	getGateStatus: (mailboxId: string, emailId: string) =>
		get<{
			alreadyUnlocked: boolean
			tier: string
			keyPrice?: number
		}>(`/api/v1/gate/status/${encodeURIComponent(mailboxId)}/${encodeURIComponent(emailId)}`),
};

export default api;
