import { SignJWT } from "jose"
import type { Env } from "../types"
import type { ContentTier } from "./content-gate"

const DEFAULT_EXPIRIES: Record<ContentTier, number> = {
	public: 3600,
	subscribers: 86400,
	ppv: 3600,
}

async function getR2SigningKey(env: Env): Promise<CryptoKey> {
	const keyMaterial = env.REFRESH_SECRET || env.ACCESS_SECRET || "onyx-r2-default-key"
	const enc = new TextEncoder()
	const keyBytes = await crypto.subtle.digest("SHA-256", enc.encode(keyMaterial))
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)
}

export async function getSignedR2Url(
	env: Env,
	mailboxId: string,
	objectKey: string,
	tier: ContentTier,
	expirySeconds?: number
): Promise<string> {
	const key = await getR2SigningKey(env)
	const now = Math.floor(Date.now() / 1000)
	const expiry = expirySeconds ?? DEFAULT_EXPIRIES[tier]

	const token = await new SignJWT({
		sub: objectKey,
		mailboxId,
		tier,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(now)
		.setExpirationTime(now + expiry)
		.sign(key)

	const encodedKey = encodeURIComponent(objectKey)
	return `/api/v1/media/r2/${encodedKey}?token=${encodeURIComponent(token)}`
}

export async function getSignedStreamToken(
	env: Env,
	videoId: string,
	tier: ContentTier,
	expirySeconds?: number
): Promise<string> {
	const { generateSignedToken } = await import("./stream")
	const expiry = expirySeconds ?? DEFAULT_EXPIRIES[tier]
	return generateSignedToken(env, videoId, expiry)
}
