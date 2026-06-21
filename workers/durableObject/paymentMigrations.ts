import type { Migration } from "./migrations"

export const paymentMigrations: Migration[] = [
	{
		name: "1_initial_setup",
		sql: `
            CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                mailbox_id TEXT NOT NULL,
                tier TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'VND',
                current_period_start TEXT NOT NULL,
                current_period_end TEXT NOT NULL,
                canceled_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                subscription_id TEXT NOT NULL,
                mailbox_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                provider TEXT NOT NULL,
                provider_txn_id TEXT,
                qr_code TEXT,
                due_date TEXT NOT NULL,
                paid_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS payment_logs (
                id TEXT PRIMARY KEY,
                idempotency_key TEXT UNIQUE NOT NULL,
                provider TEXT NOT NULL,
                event_type TEXT NOT NULL,
                raw_payload TEXT NOT NULL,
                processed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_subscriptions_mailbox ON subscriptions(mailbox_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
            CREATE INDEX IF NOT EXISTS idx_invoices_mailbox ON invoices(mailbox_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        `,
	},
	{
		name: "2_payment_link_map",
		sql: `
            CREATE TABLE IF NOT EXISTS payment_link_map (
                payment_link_id TEXT PRIMARY KEY,
                mailbox_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_payment_link_map_mailbox ON payment_link_map(mailbox_id);
        `,
	},
]
