import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const topics = sqliteTable(
	"topics",
	{
		id: text("id").primaryKey(),
		author_email: text("author_email").notNull(),
		title: text("title").notNull(),
		body_html: text("body_html").notNull().default(""),
		body_text: text("body_text").notNull().default(""),
		like_count: integer("like_count").notNull().default(0),
		dislike_count: integer("dislike_count").notNull().default(0),
		comment_count: integer("comment_count").notNull().default(0),
		created_at: text("created_at").notNull(),
		updated_at: text("updated_at").notNull(),
	},
	(table) => [index("idx_topics_created").on(table.created_at)],
);

export const topicImages = sqliteTable("topic_images", {
	id: text("id").primaryKey(),
	topic_id: text("topic_id")
		.notNull()
		.references(() => topics.id, { onDelete: "cascade" }),
	r2_key: text("r2_key").notNull(),
	content_type: text("content_type").notNull(),
	size_bytes: integer("size_bytes").notNull(),
	created_at: text("created_at").notNull(),
});

export const comments = sqliteTable(
	"comments",
	{
		id: text("id").primaryKey(),
		topic_id: text("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		author_email: text("author_email").notNull(),
		body_html: text("body_html").notNull().default(""),
		body_text: text("body_text").notNull().default(""),
		created_at: text("created_at").notNull(),
	},
	(table) => [index("idx_comments_topic").on(table.topic_id, table.created_at)],
);

export const commentImages = sqliteTable("comment_images", {
	id: text("id").primaryKey(),
	comment_id: text("comment_id")
		.notNull()
		.references(() => comments.id, { onDelete: "cascade" }),
	r2_key: text("r2_key").notNull(),
	content_type: text("content_type").notNull(),
	size_bytes: integer("size_bytes").notNull(),
	created_at: text("created_at").notNull(),
});

export const topicReactions = sqliteTable(
	"topic_reactions",
	{
		topic_id: text("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		user_email: text("user_email").notNull(),
		reaction: text("reaction").notNull(),
		created_at: text("created_at").notNull(),
	},
	(table) => [index("idx_reactions_topic").on(table.topic_id)],
);