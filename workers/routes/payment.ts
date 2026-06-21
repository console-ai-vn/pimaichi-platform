import { Hono } from "hono"
import { z } from "zod"
import { normalizeEmail } from "../lib/access"
import { getPaymentStub } from "../lib/payment-stub"
import { createPaymentLink, verifyWebhookData } from "../lib/payos"
import type { AccessVariables, Env } from "../types"
import type { PaymentDO } from "../durableObject/payment"

type PaymentContext = {
	Bindings: Env
	Variables: AccessVariables
}

const app = new Hono<PaymentContext>()

const TIERS: Record<string, number> = {
	basic: 190000,
	pro: 490000,
	premium: 990000,
}

const CheckoutBody = z.object({
	mailboxId: z.string().email(),
	tier: z.enum(["basic", "pro", "premium"]),
})

function getGlobalPaymentStub(env: Env) {
	const id = env.PAYMENT.idFromName("__payment_links__")
	return env.PAYMENT.get(id) as unknown as DurableObjectStub<PaymentDO>
}

// POST /api/v1/payments/checkout
app.post("/checkout", async (c) => {
	let body: z.infer<typeof CheckoutBody>
	try {
		body = CheckoutBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body. Required: mailboxId (email), tier (basic|pro|premium)" }, 400)
	}

	const mailboxId = normalizeEmail(body.mailboxId)
	const amount = TIERS[body.tier]
	const stub = getPaymentStub(c.env, mailboxId)

	const existing = await stub.getSubscription(mailboxId)
	if (existing && existing.status !== "cancelled") {
		return c.json({ error: `Subscription already exists with status: ${existing.status}` }, 409)
	}

	const description = `${body.tier}`
	const origin = new URL(c.req.url).origin
	const cancelUrl = `${origin}/pricing`
	const returnUrl = `${origin}/checkout?mailboxId=${encodeURIComponent(mailboxId)}&tier=${body.tier}`

	let paymentResult
	try {
		paymentResult = await createPaymentLink(c.env, amount, description, cancelUrl, returnUrl)
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Failed to create payment link" }, 500)
	}

	const subscription = await stub.createSubscription(mailboxId, body.tier, amount)
	const invoice = await stub.createInvoice(subscription.id, mailboxId, amount, "payos", paymentResult.qrImageUrl)

	await stub.setProviderTxnId(invoice.id, paymentResult.paymentLinkId)

	const globalStub = getGlobalPaymentStub(c.env)
	await globalStub.storePaymentLinkId(paymentResult.paymentLinkId, mailboxId)

	return c.json({
		subscription,
		invoice,
		checkoutUrl: paymentResult.checkoutUrl,
		qrCode: paymentResult.qrImageUrl,
		qrRaw: paymentResult.qrCode,
		amount,
		tier: body.tier,
		bin: paymentResult.bin,
		accountNumber: paymentResult.accountNumber,
		accountName: paymentResult.accountName,
	}, 201)
})

// GET /api/v1/payments/invoice/:id
app.get("/invoice/:id", async (c) => {
	const invoiceId = c.req.param("id")!
	const mailboxId = normalizeEmail(c.req.query("mailboxId") || "")
	if (!mailboxId) {
		return c.json({ error: "mailboxId query param required" }, 400)
	}

	const stub = getPaymentStub(c.env, mailboxId)
	const invoice = await stub.getInvoice(invoiceId)
	if (!invoice) {
		return c.json({ error: "Invoice not found" }, 404)
	}

	const subscription = await stub.getSubscription(mailboxId)

	return c.json({ invoice, subscription })
})

// POST /api/v1/payments/webhook
app.post("/webhook", async (c) => {
	const rawBody = await c.req.json().catch(() => null)
	if (!rawBody) {
		return c.json({ error: "Invalid JSON body" }, 400)
	}

	let webhookData
	try {
		webhookData = await verifyWebhookData(c.env, rawBody)
	} catch {
		return c.json({ error: "Invalid webhook signature" }, 403)
	}

	if (webhookData.code !== "00") {
		return c.json({ status: "payment_failed", desc: webhookData.desc }, 200)
	}

	const { paymentLinkId, amount, reference, transactionDateTime } = webhookData
	if (!paymentLinkId) {
		return c.json({ error: "Missing paymentLinkId in webhook" }, 400)
	}

	const idempotencyKey = `payos:${paymentLinkId}:${reference}`
	const globalStub = getGlobalPaymentStub(c.env)

	const logResult = await globalStub.webhookLog(idempotencyKey, "payos", "payment.success", JSON.stringify(rawBody))
	if (logResult.duplicate) {
		return c.json({ status: "duplicate" }, 200)
	}

	const mailboxId = await globalStub.lookupPaymentLinkId(paymentLinkId)
	if (!mailboxId) {
		return c.json({ error: "No pending invoice found for this payment link" }, 404)
	}

	const stub = getPaymentStub(c.env, mailboxId)
	const invoices = await stub.getInvoices(mailboxId)
	const pendingInvoice = invoices.find(
		(inv) => inv.providerTxnId === paymentLinkId && inv.status === "pending",
	)

	if (!pendingInvoice) {
		return c.json({ status: "no_pending_invoice" }, 200)
	}

	if (amount < pendingInvoice.amount) {
		return c.json({ error: `Insufficient amount: received ${amount}, expected ${pendingInvoice.amount}` }, 400)
	}

	const subscription = await stub.getSubscription(mailboxId)
	if (!subscription) {
		return c.json({ error: "No subscription found" }, 404)
	}

	await stub.activateSubscription(subscription.id, reference)
	await stub.settleInvoice(pendingInvoice.id, reference)
	return c.json({ status: "activated", transactionDateTime }, 200)
})

// GET /api/v1/payments/subscription/:mailboxId
app.get("/subscription/:mailboxId", async (c) => {
	const mailboxId = normalizeEmail(c.req.param("mailboxId")!)
	const stub = getPaymentStub(c.env, mailboxId)
	const subscription = await stub.getSubscription(mailboxId)
	if (!subscription) {
		return c.json({ subscription: null })
	}
	return c.json({ subscription })
})

// POST /api/v1/payments/subscription/:mailboxId/cancel
app.post("/subscription/:mailboxId/cancel", async (c) => {
	const mailboxId = normalizeEmail(c.req.param("mailboxId")!)
	const stub = getPaymentStub(c.env, mailboxId)
	const subscription = await stub.getSubscription(mailboxId)

	if (!subscription) {
		return c.json({ error: "No active subscription" }, 404)
	}

	if (subscription.status !== "active" && subscription.status !== "past_due") {
		return c.json({ error: "Subscription is not in a cancellable state" }, 400)
	}

	const cancelled = await stub.cancelSubscription(subscription.id)
	return c.json({ subscription: cancelled })
})

// GET /api/v1/payments/invoices/:mailboxId
app.get("/invoices/:mailboxId", async (c) => {
	const mailboxId = normalizeEmail(c.req.param("mailboxId")!)
	const stub = getPaymentStub(c.env, mailboxId)
	const invoices = await stub.getInvoices(mailboxId)
	return c.json({ invoices })
})

export { app }
