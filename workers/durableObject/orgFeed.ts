import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { and, desc, eq, sql } from "drizzle-orm";
import * as feedSchema from "../db/feed-schema";
import type { Env } from "../types";
import { applyMigrations } from "./migrations";
import { orgFeedMigrations } from "./orgFeedMigrations";

export interface FeedImageInput {
	id: string;
	r2Key: string;
	contentType: string;
	sizeBytes: number;
}

export interface TopicPayload {
	title: string;
	bodyHtml: string;
	bodyText: string;
}

export interface CommentPayload {
	bodyHtml: string;
	bodyText: string;
}

function mapTopicRow(
	row: typeof feedSchema.topics.$inferSelect,
	images: typeof feedSchema.topicImages.$inferSelect[],
	userReaction: string | null,
) {
	return {
		id: row.id,
		authorEmail: row.author_email,
		title: row.title,
		bodyHtml: row.body_html,
		bodyText: row.body_text,
		likeCount: row.like_count,
		dislikeCount: row.dislike_count,
		commentCount: row.comment_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		userReaction,
		images: images.map((image) => ({
			id: image.id,
			contentType: image.content_type,
			sizeBytes: image.size_bytes,
			createdAt: image.created_at,
		})),
	};
}

export class OrgFeedDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never;
	db: ReturnType<typeof drizzle>;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.db = drizzle(this.ctx.storage, { schema: feedSchema });
		applyMigrations(this.ctx.storage.sql, orgFeedMigrations, this.ctx.storage);
	}

	async listTopics(page = 1, limit = 20, viewerEmail?: string) {
		const safeLimit = Math.min(Math.max(limit, 1), 50);
		const offset = (Math.max(page, 1) - 1) * safeLimit;
		const rows = this.db
			.select()
			.from(feedSchema.topics)
			.orderBy(desc(feedSchema.topics.created_at))
			.limit(safeLimit)
			.offset(offset)
			.all();

		const total = this.db
			.select({ count: sql<number>`count(*)` })
			.from(feedSchema.topics)
			.get()?.count ?? 0;

		const topics = await Promise.all(
			rows.map(async (row) => {
				const images = this.db
					.select()
					.from(feedSchema.topicImages)
					.where(eq(feedSchema.topicImages.topic_id, row.id))
					.all();
				const userReaction = viewerEmail
					? this.getUserReaction(row.id, viewerEmail)
					: null;
				return mapTopicRow(row, images, userReaction);
			}),
		);

		return { topics, totalCount: total, page, limit: safeLimit };
	}

	async getTopic(topicId: string, viewerEmail?: string) {
		const row = this.db
			.select()
			.from(feedSchema.topics)
			.where(eq(feedSchema.topics.id, topicId))
			.get();
		if (!row) return null;

		const images = this.db
			.select()
			.from(feedSchema.topicImages)
			.where(eq(feedSchema.topicImages.topic_id, topicId))
			.all();
		const userReaction = viewerEmail
			? this.getUserReaction(topicId, viewerEmail)
			: null;
		return mapTopicRow(row, images, userReaction);
	}

	async createTopic(authorEmail: string, payload: TopicPayload) {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		this.db
			.insert(feedSchema.topics)
			.values({
				id,
				author_email: authorEmail.trim().toLowerCase(),
				title: payload.title.trim(),
				body_html: payload.bodyHtml,
				body_text: payload.bodyText,
				created_at: now,
				updated_at: now,
			})
			.run();
		return this.getTopic(id, authorEmail);
	}

	async attachTopicImages(topicId: string, images: FeedImageInput[]) {
		const now = new Date().toISOString();
		for (const image of images) {
			this.db
				.insert(feedSchema.topicImages)
				.values({
					id: image.id,
					topic_id: topicId,
					r2_key: image.r2Key,
					content_type: image.contentType,
					size_bytes: image.sizeBytes,
					created_at: now,
				})
				.run();
		}
	}

	async listComments(topicId: string, page = 1, limit = 50) {
		const safeLimit = Math.min(Math.max(limit, 1), 100);
		const offset = (Math.max(page, 1) - 1) * safeLimit;
		const rows = this.db
			.select()
			.from(feedSchema.comments)
			.where(eq(feedSchema.comments.topic_id, topicId))
			.orderBy(feedSchema.comments.created_at)
			.limit(safeLimit)
			.offset(offset)
			.all();

		const comments = rows.map((row) => {
			const images = this.db
				.select()
				.from(feedSchema.commentImages)
				.where(eq(feedSchema.commentImages.comment_id, row.id))
				.all();
			return {
				id: row.id,
				topicId: row.topic_id,
				authorEmail: row.author_email,
				bodyHtml: row.body_html,
				bodyText: row.body_text,
				createdAt: row.created_at,
				images: images.map((image) => ({
					id: image.id,
					contentType: image.content_type,
					sizeBytes: image.size_bytes,
					createdAt: image.created_at,
				})),
			};
		});

		return { comments, page, limit: safeLimit };
	}

	async createComment(
		topicId: string,
		authorEmail: string,
		payload: CommentPayload,
	) {
		const topic = this.db
			.select({ id: feedSchema.topics.id })
			.from(feedSchema.topics)
			.where(eq(feedSchema.topics.id, topicId))
			.get();
		if (!topic) throw new Error("Topic not found");

		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		this.db
			.insert(feedSchema.comments)
			.values({
				id,
				topic_id: topicId,
				author_email: authorEmail.trim().toLowerCase(),
				body_html: payload.bodyHtml,
				body_text: payload.bodyText,
				created_at: now,
			})
			.run();
		this.db
			.update(feedSchema.topics)
			.set({
				comment_count: sql`${feedSchema.topics.comment_count} + 1`,
				updated_at: now,
			})
			.where(eq(feedSchema.topics.id, topicId))
			.run();

		const row = this.db
			.select()
			.from(feedSchema.comments)
			.where(eq(feedSchema.comments.id, id))
			.get();
		return {
			id: row!.id,
			topicId: row!.topic_id,
			authorEmail: row!.author_email,
			bodyHtml: row!.body_html,
			bodyText: row!.body_text,
			createdAt: row!.created_at,
			images: [],
		};
	}

	async attachCommentImages(commentId: string, images: FeedImageInput[]) {
		const now = new Date().toISOString();
		for (const image of images) {
			this.db
				.insert(feedSchema.commentImages)
				.values({
					id: image.id,
					comment_id: commentId,
					r2_key: image.r2Key,
					content_type: image.contentType,
					size_bytes: image.sizeBytes,
					created_at: now,
				})
				.run();
		}
	}

	async setReaction(
		topicId: string,
		userEmail: string,
		reaction: "like" | "dislike" | null,
	) {
		const normalized = userEmail.trim().toLowerCase();
		const topic = this.db
			.select()
			.from(feedSchema.topics)
			.where(eq(feedSchema.topics.id, topicId))
			.get();
		if (!topic) throw new Error("Topic not found");

		const existing = this.db
			.select()
			.from(feedSchema.topicReactions)
			.where(
				and(
					eq(feedSchema.topicReactions.topic_id, topicId),
					eq(feedSchema.topicReactions.user_email, normalized),
				),
			)
			.get();

		const now = new Date().toISOString();
		let likeDelta = 0;
		let dislikeDelta = 0;

		if (!existing && reaction) {
			this.db
				.insert(feedSchema.topicReactions)
				.values({
					topic_id: topicId,
					user_email: normalized,
					reaction,
					created_at: now,
				})
				.run();
			if (reaction === "like") likeDelta = 1;
			else dislikeDelta = 1;
		} else if (existing && !reaction) {
			this.db
				.delete(feedSchema.topicReactions)
				.where(
					and(
						eq(feedSchema.topicReactions.topic_id, topicId),
						eq(feedSchema.topicReactions.user_email, normalized),
					),
				)
				.run();
			if (existing.reaction === "like") likeDelta = -1;
			else dislikeDelta = -1;
		} else if (existing && reaction && existing.reaction !== reaction) {
			this.db
				.update(feedSchema.topicReactions)
				.set({ reaction, created_at: now })
				.where(
					and(
						eq(feedSchema.topicReactions.topic_id, topicId),
						eq(feedSchema.topicReactions.user_email, normalized),
					),
				)
				.run();
			if (reaction === "like") {
				likeDelta = 1;
				dislikeDelta = -1;
			} else {
				likeDelta = -1;
				dislikeDelta = 1;
			}
		}

		if (likeDelta || dislikeDelta) {
			this.db
				.update(feedSchema.topics)
				.set({
					like_count: Math.max(0, topic.like_count + likeDelta),
					dislike_count: Math.max(0, topic.dislike_count + dislikeDelta),
					updated_at: now,
				})
				.where(eq(feedSchema.topics.id, topicId))
				.run();
		}

		return this.getTopic(topicId, normalized);
	}

	getTopicImage(topicId: string, imageId: string) {
		return this.db
			.select()
			.from(feedSchema.topicImages)
			.where(
				and(
					eq(feedSchema.topicImages.topic_id, topicId),
					eq(feedSchema.topicImages.id, imageId),
				),
			)
			.get();
	}

	getCommentImage(commentId: string, imageId: string) {
		return this.db
			.select()
			.from(feedSchema.commentImages)
			.where(
				and(
					eq(feedSchema.commentImages.comment_id, commentId),
					eq(feedSchema.commentImages.id, imageId),
				),
			)
			.get();
	}

	private getUserReaction(topicId: string, userEmail: string) {
		const row = this.db
			.select({ reaction: feedSchema.topicReactions.reaction })
			.from(feedSchema.topicReactions)
			.where(
				and(
					eq(feedSchema.topicReactions.topic_id, topicId),
					eq(
						feedSchema.topicReactions.user_email,
						userEmail.trim().toLowerCase(),
					),
				),
			)
			.get();
		return row?.reaction ?? null;
	}
}