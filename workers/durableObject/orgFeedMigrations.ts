import type { Migration } from "./migrations";

function txn(sql: string): string {
	const trimmed = sql.trim();
	if (/^\s*BEGIN\b/i.test(trimmed)) return trimmed;
	return `BEGIN TRANSACTION;\n${trimmed}\nCOMMIT;`;
}

export const orgFeedMigrations: Migration[] = [
	{
		name: "16_add_home_feed",
		sql: txn(`
CREATE TABLE topics (
	id TEXT PRIMARY KEY,
	author_email TEXT NOT NULL,
	title TEXT NOT NULL,
	body_html TEXT NOT NULL DEFAULT '',
	body_text TEXT NOT NULL DEFAULT '',
	like_count INTEGER NOT NULL DEFAULT 0,
	dislike_count INTEGER NOT NULL DEFAULT 0,
	comment_count INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_topics_created ON topics(created_at DESC);

CREATE TABLE topic_images (
	id TEXT PRIMARY KEY,
	topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
	r2_key TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
	author_email TEXT NOT NULL,
	body_html TEXT NOT NULL DEFAULT '',
	body_text TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);
CREATE INDEX idx_comments_topic ON comments(topic_id, created_at);

CREATE TABLE comment_images (
	id TEXT PRIMARY KEY,
	comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
	r2_key TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE topic_reactions (
	topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
	user_email TEXT NOT NULL,
	reaction TEXT NOT NULL CHECK(reaction IN ('like', 'dislike')),
	created_at TEXT NOT NULL,
	PRIMARY KEY (topic_id, user_email)
);
CREATE INDEX idx_reactions_topic ON topic_reactions(topic_id);
		`),
	},
];