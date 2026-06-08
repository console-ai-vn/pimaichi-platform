// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/** Centralised query key factories for cache invalidation. */
export const queryKeys = {
	mailboxes: {
		all: ["mailboxes"] as const,
		detail: (id: string) => ["mailboxes", id] as const,
	},
	emails: {
		list: (mailboxId: string, params: Record<string, string>) =>
			["emails", mailboxId, params] as const,
		detail: (mailboxId: string, emailId: string) =>
			["emails", mailboxId, emailId] as const,
		thread: (mailboxId: string, threadId: string) =>
			["emails", mailboxId, "thread", threadId] as const,
		conversationState: (mailboxId: string, threadId: string) =>
			["emails", mailboxId, "thread", threadId, "state"] as const,
		internalNotes: (mailboxId: string, threadId: string) =>
			["emails", mailboxId, "thread", threadId, "notes"] as const,
		conversationEvents: (mailboxId: string, threadId: string) =>
			["emails", mailboxId, "thread", threadId, "events"] as const,
		contactProfile: (mailboxId: string, emailAddress: string) =>
			["emails", mailboxId, "contact", emailAddress] as const,
	},
	folders: {
		list: (mailboxId: string) => ["folders", mailboxId] as const,
	},
	search: {
		results: (mailboxId: string, query: string, page: number) =>
			["search", mailboxId, query, page] as const,
	},
	config: ["config"] as const,
	boards: {
		all: ["boards"] as const,
	},
	home: {
		topics: (page: number) => ["home", "topics", page] as const,
		topic: (id: string) => ["home", "topic", id] as const,
		comments: (topicId: string) => ["home", "comments", topicId] as const,
	},
	audit: {
		list: (mailboxId: string, params: Record<string, string>) =>
			["audit", mailboxId, params] as const,
		retention: (mailboxId: string) => ["retention", mailboxId] as const,
	},
	admin: {
		domains: ["admin", "domains"] as const,
		permissions: (mailboxId: string) => ["admin", "permissions", mailboxId] as const,
	},
};
