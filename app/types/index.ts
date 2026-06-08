// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface SignatureSettings {
	enabled: boolean;
	text: string;
	html?: string;
}

export interface MailboxSettings {
	fromName?: string;
	bio?: string;
	location?: string;
	website?: string;
	avatarUpdatedAt?: string;
	coverUpdatedAt?: string;
	isPublicBoard?: boolean;
	boardName?: string;
	boardDescription?: string;
	forwarding?: { enabled: boolean; email: string };
	signature?: SignatureSettings;
	autoReply?: { enabled: boolean; subject: string; message: string };
	agentSystemPrompt?: string;
}

export interface Mailbox {
	id: string;
	email: string;
	name: string;
	settings?: MailboxSettings;
}

export interface ForumBoard {
	id: string;
	email: string;
	boardName: string;
	boardDescription?: string;
	canPost: boolean;
	avatarUpdatedAt?: string;
	coverUpdatedAt?: string;
}

export interface Email {
	id: string;
	thread_id?: string | null;
	folder_id?: string | null;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string;
	bcc?: string;
	date: string;
	read: boolean;
	starred: boolean;
	body?: string | null;
	in_reply_to?: string | null;
	email_references?: string | null;
	message_id?: string | null;
	raw_headers?: string | null;
	attachments?: Attachment[];
	snippet?: string | null;
	// Thread aggregate fields (only present in threaded list view)
	thread_count?: number;
	thread_unread_count?: number;
	participants?: string;
	needs_reply?: boolean;
	has_draft?: boolean;
	assignee_email?: string | null;
	status?: "open" | "waiting" | "done";
	priority?: "low" | "normal" | "high";
	state_needs_reply?: boolean;
	last_seen_at?: string | null;
	contact_email?: string | null;
	contact_display_name?: string | null;
	contact_bio?: string | null;
	contact_description?: string | null;
	contact_relationship?: string | null;
	contact_relationship_stage?: string | null;
	contact_tags?: string | null;
	contact_memory?: string | null;
	contact_location?: string | null;
	contact_website?: string | null;
	contact_last_seen_at?: string | null;
}

export interface ConversationState {
	thread_id: string;
	assignee_email?: string | null;
	status: "open" | "waiting" | "done";
	priority: "low" | "normal" | "high";
	needs_reply: boolean;
	last_seen_at?: string | null;
	updated_at?: string | null;
}

export interface ContactProfile {
	id: string;
	email: string;
	display_name?: string | null;
	bio?: string | null;
	contact_description?: string | null;
	relationship?: string | null;
	relationship_stage?: string | null;
	tags?: string | null;
	memory?: string | null;
	location?: string | null;
	website?: string | null;
	first_seen_at: string;
	last_seen_at: string;
	updated_at?: string | null;
	blocked?: boolean;
	threads?: Array<{ thread_id: string }>;
}

export interface Attachment {
	id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string;
	disposition?: string;
}

export interface Folder {
	id: string;
	name: string;
	unreadCount: number;
}

export interface InternalNote {
	id: string;
	thread_id: string;
	author_email: string;
	body: string;
	created_at: string;
	updated_at: string;
}

export interface ConversationEvent {
	id: string;
	thread_id: string;
	type: "email_received" | "email_sent" | "note_created" | "state_updated";
	actor_email?: string | null;
	payload?: Record<string, unknown> | null;
	created_at: string;
}

export interface FeedImage {
	id: string;
	contentType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface HomeTopic {
	id: string;
	authorEmail: string;
	title: string;
	bodyHtml: string;
	bodyText: string;
	likeCount: number;
	dislikeCount: number;
	commentCount: number;
	createdAt: string;
	updatedAt: string;
	userReaction: "like" | "dislike" | null;
	images: FeedImage[];
}

export interface HomeComment {
	id: string;
	topicId: string;
	authorEmail: string;
	bodyHtml: string;
	bodyText: string;
	createdAt: string;
	images: FeedImage[];
}

export interface HomeTopicListResponse {
	topics: HomeTopic[];
	totalCount: number;
	page: number;
	limit: number;
}

export interface HomeCommentListResponse {
	comments: HomeComment[];
	page: number;
	limit: number;
}
