import { DurableObject } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/durable-sqlite"
import type { Env } from "../types"
import { applyMigrations } from "./migrations"
import { paymentMigrations } from "./paymentMigrations"

export interface PaymentSubscription {
	id: string
	mailboxId: string
	tier: string
	status: string
	amount: number
	currency: string
	currentPeriodStart: string
	currentPeriodEnd: string
	canceledAt: string | null
	createdAt: string
	updatedAt: string
}

export interface PaymentInvoice {
	id: string
	subscriptionId: string
	mailboxId: string
	amount: number
	status: string
	provider: string
	providerTxnId: string | null
	qrCode: string | null
	dueDate: string
	paidAt: string | null
	createdAt: string
}

export interface WebhookLogResult {
	duplicate: boolean
}

const ALARM_INTERVAL_MS = 6 * 60 * 60 * 1000

export class PaymentDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never
	db: ReturnType<typeof drizzle>

	constructor(state: DurableObjectState, env: Env) {
		super(state, env)
		this.db = drizzle(this.ctx.storage)
		applyMigrations(this.ctx.storage.sql, paymentMigrations, this.ctx.storage)
		this.ctx.blockConcurrencyWhile(async () => {
			const alarm = await this.ctx.storage.getAlarm()
			if (alarm === null) {
				await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS)
			}
		})
	}

	async alarm() {
		try {
			await this.checkExpiringSubscriptions()
		} catch (error) {
			console.error("payment alarm failed", error)
		} finally {
			await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS)
		}
	}

	async createSubscription(
		mailboxId: string,
		tier: string,
		amount: number,
	): Promise<PaymentSubscription> {
		const now = new Date().toISOString()
		const periodStart = now
		const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
		const id = crypto.randomUUID()

		this.ctx.storage.sql.exec(
			`INSERT INTO subscriptions (id, mailbox_id, tier, status, amount, currency, current_period_start, current_period_end, created_at, updated_at)
			 VALUES (?1, ?2, ?3, 'pending', ?4, 'VND', ?5, ?6, ?7, ?7)`,
			id, mailboxId, tier, amount, periodStart, periodEnd, now,
		)

		return this.getSubscriptionByRowId(id)!
	}

	async createInvoice(
		subscriptionId: string,
		mailboxId: string,
		amount: number,
		provider: string,
		qrCode?: string,
	): Promise<PaymentInvoice> {
		const now = new Date().toISOString()
		const dueDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
		const id = crypto.randomUUID()

		this.ctx.storage.sql.exec(
			`INSERT INTO invoices (id, subscription_id, mailbox_id, amount, status, provider, qr_code, due_date, created_at)
			 VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8)`,
			id, subscriptionId, mailboxId, amount, provider, qrCode ?? null, dueDate, now,
		)

		return this.getInvoiceByRowId(id)!
	}

	async activateSubscription(
		subscriptionId: string,
		providerTxnId: string,
	): Promise<PaymentSubscription | null> {
		const now = new Date().toISOString()
		const periodStart = now
		const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

		this.ctx.storage.sql.exec(
			`UPDATE subscriptions
			 SET status = 'active', current_period_start = ?1, current_period_end = ?2, updated_at = ?3
			 WHERE id = ?4`,
			periodStart, periodEnd, now, subscriptionId,
		)

		this.ctx.storage.sql.exec(
			`UPDATE invoices
			 SET status = 'paid', provider_txn_id = ?1, paid_at = ?2
			 WHERE subscription_id = ?3 AND status = 'pending'`,
			providerTxnId, now, subscriptionId,
		)

		return this.getSubscriptionByRowId(subscriptionId)
	}

	async cancelSubscription(subscriptionId: string): Promise<PaymentSubscription | null> {
		const now = new Date().toISOString()
		this.ctx.storage.sql.exec(
			`UPDATE subscriptions
			 SET status = 'cancelled', canceled_at = ?1, updated_at = ?1
			 WHERE id = ?2`,
			now, subscriptionId,
		)
		return this.getSubscriptionByRowId(subscriptionId)
	}

	async checkExpiringSubscriptions(): Promise<PaymentInvoice[]> {
		const now = new Date().toISOString()
		const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

		const expiringRows = [
			...this.ctx.storage.sql.exec(
				`SELECT id, mailbox_id, amount FROM subscriptions
				 WHERE status = 'active'
				   AND current_period_end <= ?1
				   AND current_period_end >= ?2`,
				threeDaysFromNow, now,
			),
		] as Array<{ id: string; mailbox_id: string; amount: number }>

		const invoices: PaymentInvoice[] = []
		for (const row of expiringRows) {
			const invoice = await this.createInvoice(row.id, row.mailbox_id, row.amount, "payos")
			invoices.push(invoice)
		}

		const pastDueRows = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM subscriptions
				 WHERE status = 'active' AND current_period_end < ?1`,
				now,
			),
		] as Array<{ id: string }>

		for (const row of pastDueRows) {
			this.ctx.storage.sql.exec(
				`UPDATE subscriptions SET status = 'past_due', updated_at = ?1 WHERE id = ?2`,
				now, row.id,
			)
		}

		return invoices
	}

	async getSubscription(mailboxId: string): Promise<PaymentSubscription | null> {
		const rows = [
			...this.ctx.storage.sql.exec(
				`SELECT id, mailbox_id, tier, status, amount, currency,
				        current_period_start, current_period_end, canceled_at, created_at, updated_at
				 FROM subscriptions
				 WHERE mailbox_id = ?1 AND status IN ('pending', 'active', 'past_due', 'cancelled')
				 ORDER BY created_at DESC LIMIT 1`,
				mailboxId,
			),
		] as Array<{
			id: string; mailbox_id: string; tier: string; status: string
			amount: number; currency: string; current_period_start: string
			current_period_end: string; canceled_at: string | null
			created_at: string; updated_at: string
		}>

		if (rows.length === 0) return null
		return this.mapSubscriptionRow(rows[0])
	}

	async getInvoices(mailboxId: string): Promise<PaymentInvoice[]> {
		const rows = [
			...this.ctx.storage.sql.exec(
				`SELECT id, subscription_id, mailbox_id, amount, status, provider,
				        provider_txn_id, qr_code, due_date, paid_at, created_at
				 FROM invoices
				 WHERE mailbox_id = ?1
				 ORDER BY created_at DESC`,
				mailboxId,
			),
		] as Array<{
			id: string; subscription_id: string; mailbox_id: string; amount: number
			status: string; provider: string; provider_txn_id: string | null
			qr_code: string | null; due_date: string; paid_at: string | null
			created_at: string
		}>

		return rows.map((row) => ({
			id: row.id,
			subscriptionId: row.subscription_id,
			mailboxId: row.mailbox_id,
			amount: row.amount,
			status: row.status,
			provider: row.provider,
			providerTxnId: row.provider_txn_id,
			qrCode: row.qr_code,
			dueDate: row.due_date,
			paidAt: row.paid_at,
			createdAt: row.created_at,
		}))
	}

	async getInvoice(invoiceId: string): Promise<PaymentInvoice | null> {
		return this.getInvoiceByRowId(invoiceId)
	}

	async setProviderTxnId(invoiceId: string, txnId: string): Promise<void> {
		this.ctx.storage.sql.exec(
			`UPDATE invoices SET provider_txn_id = ?1 WHERE id = ?2`,
			txnId, invoiceId,
		)
	}

	async storePaymentLinkId(paymentLinkId: string, mailboxId: string): Promise<void> {
		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO payment_link_map (payment_link_id, mailbox_id, created_at)
			 VALUES (?1, ?2, ?3)`,
			paymentLinkId, mailboxId, new Date().toISOString(),
		)
	}

	async lookupPaymentLinkId(paymentLinkId: string): Promise<string | null> {
		const rows = [
			...this.ctx.storage.sql.exec(
				`SELECT mailbox_id FROM payment_link_map WHERE payment_link_id = ?1`,
				paymentLinkId,
			),
		] as Array<{ mailbox_id: string }>
		return rows.length > 0 ? rows[0].mailbox_id : null
	}

	async webhookLog(
		idempotencyKey: string,
		provider: string,
		eventType: string,
		payload: string,
	): Promise<WebhookLogResult> {
		const existing = [
			...this.ctx.storage.sql.exec(
				`SELECT id FROM payment_logs WHERE idempotency_key = ?1`,
				idempotencyKey,
			),
		]

		if (existing.length > 0) {
			return { duplicate: true }
		}

		const now = new Date().toISOString()
		this.ctx.storage.sql.exec(
			`INSERT INTO payment_logs (id, idempotency_key, provider, event_type, raw_payload, processed, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)`,
			crypto.randomUUID(), idempotencyKey, provider, eventType, payload, now,
		)

		return { duplicate: false }
	}

	private getSubscriptionByRowId(id: string): PaymentSubscription | null {
		const rows = [
			...this.ctx.storage.sql.exec(
				`SELECT id, mailbox_id, tier, status, amount, currency,
				        current_period_start, current_period_end, canceled_at, created_at, updated_at
				 FROM subscriptions WHERE id = ?1`,
				id,
			),
		] as Array<{
			id: string; mailbox_id: string; tier: string; status: string
			amount: number; currency: string; current_period_start: string
			current_period_end: string; canceled_at: string | null
			created_at: string; updated_at: string
		}>

		if (rows.length === 0) return null
		return this.mapSubscriptionRow(rows[0])
	}

	private getInvoiceByRowId(id: string): PaymentInvoice | null {
		const rows = [
			...this.ctx.storage.sql.exec(
				`SELECT id, subscription_id, mailbox_id, amount, status, provider,
				        provider_txn_id, qr_code, due_date, paid_at, created_at
				 FROM invoices WHERE id = ?1`,
				id,
			),
		] as Array<{
			id: string; subscription_id: string; mailbox_id: string; amount: number
			status: string; provider: string; provider_txn_id: string | null
			qr_code: string | null; due_date: string; paid_at: string | null
			created_at: string
		}>

		if (rows.length === 0) return null
		return {
			id: rows[0].id,
			subscriptionId: rows[0].subscription_id,
			mailboxId: rows[0].mailbox_id,
			amount: rows[0].amount,
			status: rows[0].status,
			provider: rows[0].provider,
			providerTxnId: rows[0].provider_txn_id,
			qrCode: rows[0].qr_code,
			dueDate: rows[0].due_date,
			paidAt: rows[0].paid_at,
			createdAt: rows[0].created_at,
		}
	}

	private mapSubscriptionRow(row: {
		id: string; mailbox_id: string; tier: string; status: string
		amount: number; currency: string; current_period_start: string
		current_period_end: string; canceled_at: string | null
		created_at: string; updated_at: string
	}): PaymentSubscription {
		return {
			id: row.id,
			mailboxId: row.mailbox_id,
			tier: row.tier,
			status: row.status,
			amount: row.amount,
			currency: row.currency,
			currentPeriodStart: row.current_period_start,
			currentPeriodEnd: row.current_period_end,
			canceledAt: row.canceled_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}
	}
}
