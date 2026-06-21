import { Hono } from "hono"
import { z } from "zod"
import { normalizeEmail } from "../lib/access"
import { assertAdminAccess, getDomainConfig } from "../lib/admin"
import { getInventoryStub } from "../lib/inventory-stub"
import { getPaymentStub } from "../lib/payment-stub"
import { validateItemDetails } from "../lib/items"
import type { AccessVariables, Env } from "../types"

type InventoryContext = {
	Bindings: Env
	Variables: AccessVariables
}

const app = new Hono<InventoryContext>()

// ── Schemas ────────────────────────────────────────────────

const CreateItemBody = z.object({
	creatorMailboxId: z.string().email(),
	type: z.string(),
	name: z.string().min(1).max(200),
	description: z.string().min(1).max(2000),
	price: z.number().min(0),
	imageUrl: z.string().max(2048).optional().default(""),
})

const UpdateItemBody = z.object({
	type: z.string().optional(),
	name: z.string().min(1).max(200).optional(),
	description: z.string().min(1).max(2000).optional(),
	price: z.number().min(0).optional(),
	imageUrl: z.string().max(2048).optional(),
})

const PurchaseBody = z.object({
	userEmail: z.string().email(),
	itemId: z.string().min(1),
})

const ConsumeBody = z.object({
	userEmail: z.string().email(),
	itemId: z.string().min(1),
	resourceType: z.string().min(1),
	resourceId: z.string().min(1),
})

// ── Catalog Routes ─────────────────────────────────────────

// GET /api/v1/inventory/catalog — global items
app.get("/api/v1/inventory/catalog", async (c) => {
	const stub = getInventoryStub(c.env)
	const items = await stub.getCatalogItems()
	return c.json({ items })
})

// GET /api/v1/inventory/catalog/:creatorMailboxId — creator items
app.get("/api/v1/inventory/catalog/:creatorMailboxId", async (c) => {
	const creatorMailboxId = normalizeEmail(c.req.param("creatorMailboxId")!)
	const stub = getInventoryStub(c.env)
	const items = await stub.getCatalogItems(creatorMailboxId)
	return c.json({ items })
})

// POST /api/v1/inventory/catalog — create item (admin only)
app.post("/api/v1/inventory/catalog", async (c) => {
	try {
		const config = await getDomainConfig(c.env)
		assertAdminAccess(c.var.accessEmail, config.accessEmailAddresses)
	} catch {
		return c.json({ error: "Admin access required" }, 403)
	}

	let body: z.infer<typeof CreateItemBody>
	try {
		body = CreateItemBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body" }, 400)
	}

	const validation = validateItemDetails(body)
	if (!validation.ok) {
		return c.json({ error: validation.error }, 400)
	}

	const stub = getInventoryStub(c.env)
	const item = await stub.createCatalogItem({
		creatorMailboxId: normalizeEmail(body.creatorMailboxId),
		type: body.type as never,
		name: body.name,
		description: body.description,
		price: body.price,
		imageUrl: body.imageUrl,
	})

	return c.json({ item }, 201)
})

// PATCH /api/v1/inventory/catalog/:itemId — update item
app.patch("/api/v1/inventory/catalog/:itemId", async (c) => {
	try {
		const config = await getDomainConfig(c.env)
		assertAdminAccess(c.var.accessEmail, config.accessEmailAddresses)
	} catch {
		return c.json({ error: "Admin access required" }, 403)
	}

	const itemId = c.req.param("itemId")!

	let body: z.infer<typeof UpdateItemBody>
	try {
		body = UpdateItemBody.parse(await c.req.json())
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: error.issues[0]?.message || "Invalid request body" }, 400)
		}
		return c.json({ error: "Invalid request body" }, 400)
	}

	const stub = getInventoryStub(c.env)
	const item = await stub.updateCatalogItem(itemId, body)
	if (!item) {
		return c.json({ error: "Item not found" }, 404)
	}

	return c.json({ item })
})

// DELETE /api/v1/inventory/catalog/:itemId — deactivate
app.delete("/api/v1/inventory/catalog/:itemId", async (c) => {
	try {
		const config = await getDomainConfig(c.env)
		assertAdminAccess(c.var.accessEmail, config.accessEmailAddresses)
	} catch {
		return c.json({ error: "Admin access required" }, 403)
	}

	const itemId = c.req.param("itemId")!
	const stub = getInventoryStub(c.env)
	await stub.deactivateCatalogItem(itemId)
	return c.body(null, 204)
})

// ── Purchase Route ─────────────────────────────────────────

// POST /api/v1/inventory/purchase — create payment intent via PaymentDO
app.post("/api/v1/inventory/purchase", async (c) => {
	let body: z.infer<typeof PurchaseBody>
	try {
		body = PurchaseBody.parse(await c.req.json())
	} catch {
		return c.json({ error: "Invalid request body. Required: userEmail, itemId" }, 400)
	}

	const userEmail = normalizeEmail(body.userEmail)
	const stub = getInventoryStub(c.env)

	// Verify item exists and is active
	const catalogItems = await stub.getCatalogItems()
	const item = catalogItems.find((i) => i.id === body.itemId)
	if (!item) {
		return c.json({ error: "Item not found or not available" }, 404)
	}

	// Create payment via PaymentDO (use the creator's mailbox as context)
	const paymentStub = getPaymentStub(c.env, item.creatorMailboxId)
	const subscription = await paymentStub.createSubscription(
		item.creatorMailboxId,
		`item_${item.id}`,
		item.price,
	)

	const invoice = await paymentStub.createInvoice(
		subscription.id,
		item.creatorMailboxId,
		item.price,
		"payos",
	)

	// Grant the item immediately after purchase (will be consumed later)
	const inventoryEntry = await stub.grantItem({
		userEmail,
		itemId: item.id,
		purchaseId: invoice.id,
	})

	return c.json({
		inventoryEntry,
		subscription,
		invoice,
		item,
	}, 201)
})

// ── User Inventory Routes ──────────────────────────────────

// GET /api/v1/inventory/inventory/:userEmail — user's items
app.get("/api/v1/inventory/inventory/:userEmail", async (c) => {
	const userEmail = normalizeEmail(c.req.param("userEmail")!)
	const type = c.req.query("type") || undefined
	const status = c.req.query("status") || undefined

	const stub = getInventoryStub(c.env)
	const items = await stub.getUserItems(userEmail, type, status)
	return c.json({ items })
})

// POST /api/v1/inventory/consume — use item
app.post("/api/v1/inventory/consume", async (c) => {
	let body: z.infer<typeof ConsumeBody>
	try {
		body = ConsumeBody.parse(await c.req.json())
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: error.issues[0]?.message || "Invalid request body" }, 400)
		}
		return c.json({ error: "Invalid request body" }, 400)
	}

	const stub = getInventoryStub(c.env)
	const result = await stub.consumeItem({
		userEmail: normalizeEmail(body.userEmail),
		itemId: body.itemId,
		resourceType: body.resourceType,
		resourceId: body.resourceId,
	})

	if (!result.success) {
		return c.json({ error: "No active item found to consume" }, 404)
	}

	return c.json({ success: true })
})

// GET /api/v1/inventory/history/:userEmail — purchase history
app.get("/api/v1/inventory/history/:userEmail", async (c) => {
	const userEmail = normalizeEmail(c.req.param("userEmail")!)
	const stub = getInventoryStub(c.env)
	const history = await stub.getPurchaseHistory(userEmail)
	return c.json({ history })
})

export { app }
