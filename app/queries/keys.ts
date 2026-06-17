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
		topics: (page: number, limit = 20) => ["home", "topics", page, limit] as const,
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
		signupRequests: ["admin", "signup-requests"] as const,
		permissions: (mailboxId: string) => ["admin", "permissions", mailboxId] as const,
	},
	payments: {
		subscription: (mailboxId: string) => ["payments", "subscription", mailboxId] as const,
		invoice: (id: string) => ["payments", "invoice", id] as const,
		invoices: (mailboxId: string) => ["payments", "invoices", mailboxId] as const,
	},
	inventory: {
		catalog: (creatorMailboxId?: string) =>
			creatorMailboxId
				? (["inventory", "catalog", creatorMailboxId] as const)
				: (["inventory", "catalog"] as const),
		userItems: (userEmail: string) => ["inventory", "items", userEmail] as const,
		history: (userEmail: string) => ["inventory", "history", userEmail] as const,
	},
	gate: {
		check: (mailboxId: string, emailId: string) =>
			["gate", "check", mailboxId, emailId] as const,
		status: (mailboxId: string, emailId: string) =>
			["gate", "status", mailboxId, emailId] as const,
	},
};
