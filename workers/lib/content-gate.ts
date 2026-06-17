import type { Env } from "../types"
import { getPaymentStub } from "../lib/payment-stub"
import { getInventoryStub } from "../lib/inventory-stub"

export type ContentTier = "public" | "subscribers" | "ppv"

export interface GateMetadata {
	contentTier: ContentTier
	ppvKeyPrice?: number
	allowPreview: boolean
}

export interface GateCheckResult {
	allowed: boolean
	tier: ContentTier
	reason?: string
	keyPrice?: number
	requiresSubscription: boolean
	alreadyUnlocked: boolean
}

export interface CreatorSettings {
	defaultContentTier: ContentTier
	ppvKeyPrice: number
}

function normalize(email: string) {
	return email.toLowerCase().trim()
}

function unlockRecordKey(mailboxId: string, emailId: string, userEmail: string) {
	return `unlocks/${mailboxId}/${emailId}/${normalize(userEmail)}.json`
}

async function isAlreadyUnlocked(
	env: Env,
	mailboxId: string,
	emailId: string,
	userEmail: string,
): Promise<boolean> {
	const key = unlockRecordKey(mailboxId, emailId, userEmail)
	const obj = await env.BUCKET.get(key)
	return obj !== null
}

export async function checkGateAccess(
	env: Env,
	mailboxId: string,
	emailId: string,
	userEmail: string,
	gateMeta: GateMetadata
): Promise<GateCheckResult> {
	const tier = gateMeta.contentTier

	// Public content — always allowed
	if (tier === "public") {
		return {
			allowed: true,
			tier: "public",
			requiresSubscription: false,
			alreadyUnlocked: false,
		}
	}

	// No authenticated user — block non-public content
	if (!userEmail) {
		return {
			allowed: false,
			tier,
			reason: "Authentication required",
			keyPrice: gateMeta.ppvKeyPrice,
			requiresSubscription: tier === "subscribers",
			alreadyUnlocked: false,
		}
	}

	const normalizedEmail = normalize(userEmail)

	// Subscribers tier — check PaymentDO for active subscription
	if (tier === "subscribers") {
		const paymentStub = getPaymentStub(env, mailboxId)
		const subscription = await paymentStub.getSubscription(normalizedEmail)

		if (subscription && (subscription.status === "active" || subscription.status === "past_due")) {
			return {
				allowed: true,
				tier: "subscribers",
				requiresSubscription: true,
				alreadyUnlocked: true,
			}
		}

		return {
			allowed: false,
			tier: "subscribers",
			reason: "Active subscription required",
			requiresSubscription: true,
			alreadyUnlocked: false,
		}
	}

	// PPV tier — check if already unlocked, or if user has keys available
	const unlocked = await isAlreadyUnlocked(env, mailboxId, emailId, normalizedEmail)
	if (unlocked) {
		return {
			allowed: true,
			tier: "ppv",
			requiresSubscription: false,
			keyPrice: gateMeta.ppvKeyPrice,
			alreadyUnlocked: true,
		}
	}

	// Check if user has at least one active key in inventory
	const inventoryStub = getInventoryStub(env)
	const items = await inventoryStub.getUserItems(normalizedEmail, "key")
	const hasActiveKey = items.some(
		(item) => item.status === "active" && item.item_type === "key"
	)

	return {
		allowed: false,
		tier: "ppv",
		reason: hasActiveKey ? "Use a Key to unlock" : "Purchase a Key to unlock",
		keyPrice: gateMeta.ppvKeyPrice,
		requiresSubscription: false,
		alreadyUnlocked: false,
	}
}

export async function unlockPpvContent(
	env: Env,
	mailboxId: string,
	emailId: string,
	userEmail: string,
	itemId: string
): Promise<{ success: boolean; error?: string }> {
	const normalizedEmail = normalize(userEmail)
	const inventoryStub = getInventoryStub(env)
	const resourceId = `${mailboxId}:${emailId}`

	const result = await inventoryStub.consumeItem({
		userEmail: normalizedEmail,
		itemId,
		resourceType: "email_content",
		resourceId,
	})

	if (!result.success) {
		return { success: false, error: "No active Key available for this content" }
	}

	// Persist unlock record in R2 so subsequent checks see it
	const recordKey = unlockRecordKey(mailboxId, emailId, normalizedEmail)
	await env.BUCKET.put(recordKey, JSON.stringify({
		mailboxId,
		emailId,
		userEmail: normalizedEmail,
		itemId,
		unlockedAt: new Date().toISOString(),
	}), {
		httpMetadata: { contentType: "application/json" },
	})

	return { success: true }
}

export function getDefaultGateMeta(creatorSettings?: CreatorSettings): GateMetadata {
	if (!creatorSettings) {
		return {
			contentTier: "public",
			allowPreview: true,
		}
	}

	return {
		contentTier: creatorSettings.defaultContentTier,
		ppvKeyPrice: creatorSettings.ppvKeyPrice || undefined,
		allowPreview: creatorSettings.defaultContentTier !== "public",
	}
}
