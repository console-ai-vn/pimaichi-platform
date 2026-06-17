import type { Migration } from "./migrations"

export const liveMigrations: Migration[] = [
	{
		name: "1_initial_live_setup",
		sql: `
			CREATE TABLE IF NOT EXISTS live_events (
				id TEXT PRIMARY KEY,
				creator_mailbox_id TEXT NOT NULL,
				title TEXT NOT NULL,
				description TEXT DEFAULT '',
				scheduled_at TEXT,
				started_at TEXT,
				ended_at TEXT,
				status TEXT NOT NULL DEFAULT 'scheduled',
				stream_live_input_uid TEXT,
				rtmps_url TEXT,
				playback_url TEXT,
				pass_price INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE TABLE IF NOT EXISTS live_chat (
				id TEXT PRIMARY KEY,
				event_id TEXT NOT NULL,
				user_email TEXT NOT NULL,
				display_name TEXT NOT NULL,
				message TEXT NOT NULL,
				system_message INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY(event_id) REFERENCES live_events(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS live_viewers (
				id TEXT PRIMARY KEY,
				event_id TEXT NOT NULL,
				user_email TEXT NOT NULL,
				joined_at TEXT NOT NULL DEFAULT (datetime('now')),
				left_at TEXT
			);

			CREATE INDEX IF NOT EXISTS idx_live_events_creator ON live_events(creator_mailbox_id);
			CREATE INDEX IF NOT EXISTS idx_live_events_status ON live_events(status);
			CREATE INDEX IF NOT EXISTS idx_live_events_scheduled ON live_events(scheduled_at);
			CREATE INDEX IF NOT EXISTS idx_live_chat_event ON live_chat(event_id, created_at);
			CREATE INDEX IF NOT EXISTS idx_live_viewers_event ON live_viewers(event_id);
			CREATE UNIQUE INDEX IF NOT EXISTS idx_live_viewers_active ON live_viewers(event_id, user_email) WHERE left_at IS NULL;
		`,
	},
]
