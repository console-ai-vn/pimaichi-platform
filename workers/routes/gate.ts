import { Hono } from "hono"
import { z } from "zod"
import { normalizeEmail } from "../lib/access"
import { checkGateAccess, unlockPpvContent, type GateMetadata } from "../lib/content-gate"
import type { AccessVariables, Env } from "../types"

type GateContext = {
	Bindings: Env
	Variables: AccessVariables
}

const app = new Hono<GateContext>()

const UnlockBody = z.object({
	itemId: z.string().min(1),
})

// GET /api/v1/gate/check/:mailboxId/:emailId
app.get("/api/v1/gate/check/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId")
	const rawEmailId = c.req.param("emailId")
	if (!rawMailboxId || !rawEmailId) {
		return c.json({ error: "mailboxId and emailId required" }, 400)
	}

	const mailboxId = normalizeEmail(decodeURIComponent(rawMailboxId))
	const emailId = decodeURIComponent(rawEmailId)
	const userEmail = c.var.accessEmail || ""

	// Load gate meta from R2 only
	let gateMeta: GateMetadata | null = null

	const gateKey = `gates/${mailboxId}/${emailId}.json`
	const gateObj = await c.env.BUCKET.get(gateKey)
	if (gateObj) {
		gateMeta = (await gateObj.json()) as GateMetadata
	}

	if (!gateMeta) {
		// No gate configured — treat as public
		return c.json({
			allowed: true,
			tier: "public",
			requiresSubscription: false,
			alreadyUnlocked: false,
		})
	}

	const result = await checkGateAccess(
		c.env,
		mailboxId,
		emailId,
		userEmail,
		gateMeta,
	)

	return c.json(result)
})

// POST /api/v1/gate/unlock/:mailboxId/:emailId
app.post("/api/v1/gate/unlock/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId")
	const rawEmailId = c.req.param("emailId")
	if (!rawMailboxId || !rawEmailId) {
		return c.json({ error: "mailboxId and emailId required" }, 400)
	}

	const userEmail = c.var.accessEmail
	if (!userEmail) {
		return c.json({ error: "Authentication required" }, 401)
	}

	let body: z.infer<typeof UnlockBody>
	try {
		body = UnlockBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body. Required: itemId" }, 400)
	}

	const mailboxId = normalizeEmail(decodeURIComponent(rawMailboxId))
	const emailId = decodeURIComponent(rawEmailId)

	const result = await unlockPpvContent(
		c.env,
		mailboxId,
		emailId,
		userEmail,
		body.itemId,
	)

	if (!result.success) {
		return c.json({ success: false, error: result.error }, 402)
	}

	return c.json({ success: true })
})

// GET /api/v1/gate/status/:mailboxId/:emailId
app.get("/api/v1/gate/status/:mailboxId/:emailId", async (c) => {
	const rawMailboxId = c.req.param("mailboxId")
	const rawEmailId = c.req.param("emailId")
	if (!rawMailboxId || !rawEmailId) {
		return c.json({ error: "mailboxId and emailId required" }, 400)
	}

	const mailboxId = normalizeEmail(decodeURIComponent(rawMailboxId))
	const emailId = decodeURIComponent(rawEmailId)
	const userEmail = c.var.accessEmail || ""

	// Load gate meta from R2 only
	let gateMeta: GateMetadata | null = null
	const gateKey = `gates/${mailboxId}/${emailId}.json`
	const gateObj = await c.env.BUCKET.get(gateKey)
	if (gateObj) {
		gateMeta = (await gateObj.json()) as GateMetadata
	}

	if (!gateMeta) {
		return c.json({
			alreadyUnlocked: true,
			tier: "public",
			keyPrice: undefined,
		})
	}

	const result = await checkGateAccess(
		c.env,
		mailboxId,
		emailId,
		userEmail,
		gateMeta,
	)

	return c.json({
		alreadyUnlocked: result.alreadyUnlocked,
		tier: gateMeta.contentTier,
		keyPrice: gateMeta.ppvKeyPrice,
	})
})

export { app }
