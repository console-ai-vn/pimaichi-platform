import { Hono } from "hono"
import { profileAvatarKey, profileCoverKey } from "../lib/profile-avatar"
import type { AccessVariables, Env } from "../types"

type CreatorContext = {
	Bindings: Env
	Variables: AccessVariables
}

const app = new Hono<CreatorContext>()

// GET /api/v1/creator/top — featured creators list (public)
app.get("/api/v1/creator/top", async (c) => {
	try {
		const configKey = "domains.json"
		const obj = await c.env.BUCKET.get(configKey)
		if (!obj) {
			// Fallback to env EMAIL_ADDRESSES when no domains.json
			const emails = Array.isArray(c.env.EMAIL_ADDRESSES) 
				? (c.env.EMAIL_ADDRESSES as string[]).slice(0, 20) 
				: []
			if (emails.length === 0) return c.json([])
			// Continue with fallback emails below
			const creators: Array<Record<string, unknown>> = []
			for (const email of emails) {
				const mailboxKey = `mailboxes/${email.toLowerCase()}.json`
				const mailboxObj = await c.env.BUCKET.get(mailboxKey)
				if (!mailboxObj) continue
				const settings = (await mailboxObj.json()) as Record<string, unknown>
				if (settings.isPublicBoard !== true) continue
				creators.push({
					id: email,
					name: (settings.fromName as string) || email.split("@")[0] || email,
					bio: (settings.bio as string) || null,
					avatarUrl: settings.avatarUpdatedAt ? `/api/v1/creator/${encodeURIComponent(email)}/avatar` : null,
					coverUrl: settings.coverUpdatedAt ? `/api/v1/creator/${encodeURIComponent(email)}/cover` : null,
					avatarVersion: (settings.avatarUpdatedAt as string) || null,
					coverVersion: (settings.coverUpdatedAt as string) || null,
					subscriberCount: 0, postCount: 0, itemCount: 0,
					website: (settings.website as string) || null,
					location: (settings.location as string) || null,
				})
			}
			return c.json(creators)
		}

		const config = (await obj.json()) as {
			emailAddresses?: string[]
		}
		const emails = (config.emailAddresses ?? []).slice(0, 20)

		const creators: Array<Record<string, unknown>> = []
		for (const email of emails) {
			const mailboxKey = `mailboxes/${email.toLowerCase()}.json`
			const mailboxObj = await c.env.BUCKET.get(mailboxKey)
			if (!mailboxObj) continue

			const settings = (await mailboxObj.json()) as Record<string, unknown>

			// Only include creators that have opted in to being public
			if (settings.isPublicBoard !== true) continue

			creators.push({
				id: email,
				name: (settings.fromName as string) || email.split("@")[0] || email,
				bio: (settings.bio as string) || null,
				avatarUrl: settings.avatarUpdatedAt
					? `/api/v1/creator/${encodeURIComponent(email)}/avatar`
					: null,
				coverUrl: settings.coverUpdatedAt
					? `/api/v1/creator/${encodeURIComponent(email)}/cover`
					: null,
				avatarVersion: (settings.avatarUpdatedAt as string) || null,
				coverVersion: (settings.coverUpdatedAt as string) || null,
				subscriberCount: 42,
				postCount: 8,
				itemCount: 3,
				subscriptionTier: (settings.subscriptionTier as string) || "basic",
				website: (settings.website as string) || null,
				location: (settings.location as string) || null,
			})
		}

		return c.json(creators)
	} catch (err) {
		console.error("Error fetching top creators:", err)
		return c.json({ error: "Failed to fetch creators" }, 500)
	}
})

// GET /api/v1/creator/:creatorId — public creator profile
app.get("/api/v1/creator/:creatorId", async (c) => {
	try {
		const creatorId = decodeURIComponent(c.req.param("creatorId")!)
		const mailboxKey = `mailboxes/${creatorId.toLowerCase()}.json`
		const obj = await c.env.BUCKET.get(mailboxKey)
		if (!obj) return c.json({ error: "Creator not found" }, 404)

		const settings = (await obj.json()) as Record<string, unknown>

		return c.json({
			id: creatorId,
			name: (settings.fromName as string) || creatorId.split("@")[0] || creatorId,
			bio: (settings.bio as string) || null,
			avatarUrl: settings.avatarUpdatedAt
				? `/api/v1/creator/${encodeURIComponent(creatorId)}/avatar`
				: null,
			coverUrl: settings.coverUpdatedAt
				? `/api/v1/creator/${encodeURIComponent(creatorId)}/cover`
				: null,
			avatarVersion: (settings.avatarUpdatedAt as string) || null,
			coverVersion: (settings.coverUpdatedAt as string) || null,
			subscriberCount: 0,
			postCount: 0,
			itemCount: 0,
			website: (settings.website as string) || null,
			location: (settings.location as string) || null,
		})
	} catch (err) {
		console.error("Error fetching creator profile:", err)
		return c.json({ error: "Failed to fetch creator" }, 500)
	}
})

// GET /api/v1/creator/:creatorId/content — public content with gate metadata
app.get("/api/v1/creator/:creatorId/content", async (c) => {
	try {
		const creatorId = decodeURIComponent(c.req.param("creatorId")!)
		const page = parseInt(c.req.query("page") || "1", 10) || 1
		const limit = parseInt(c.req.query("limit") || "20", 10) || 20

		const DEMO_ITEMS = [
			{ id: "post-1", thumbnailUrl: "/api/v1/media/placeholder/1", title: "Buổi sáng mới 🌸", tier: "public", isUnlocked: true, createdAt: new Date().toISOString() },
			{ id: "post-2", thumbnailUrl: "/api/v1/media/placeholder/2", title: "Dạo phố cùng em 🌆", tier: "subscribers", isUnlocked: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
			{ id: "post-3", thumbnailUrl: "/api/v1/media/placeholder/3", title: "Bộ ảnh riêng tư 💜", tier: "ppv", isUnlocked: false, keyPrice: 9.99, previewUrl: "/api/v1/media/placeholder/3", createdAt: new Date(Date.now() - 7200000).toISOString() },
			{ id: "post-4", thumbnailUrl: "/api/v1/media/placeholder/4", title: "Chiều nay mặc gì? 🛍️", tier: "public", isUnlocked: true, createdAt: new Date(Date.now() - 10800000).toISOString() },
			{ id: "post-5", thumbnailUrl: null, title: "Cảm ơn 50 subscribers! ❤️", tier: "subscribers", isUnlocked: false, createdAt: new Date(Date.now() - 14400000).toISOString() },
			{ id: "post-6", thumbnailUrl: null, title: "Video hậu trường: Buổi chụp mới 🎬", tier: "ppv", isUnlocked: false, keyPrice: 14.99, createdAt: new Date(Date.now() - 18000000).toISOString() },
			{ id: "post-7", thumbnailUrl: "/api/v1/media/placeholder/7", title: "Q&A cùng Pimaichi 💬", tier: "public", isUnlocked: true, createdAt: new Date(Date.now() - 21600000).toISOString() },
			{ id: "post-8", thumbnailUrl: null, title: "Tâm sự cùng subscribers 🥰", tier: "subscribers", isUnlocked: false, createdAt: new Date(Date.now() - 25200000).toISOString() },
		]

		const filtered = creatorId !== "pimaichi1003" && creatorId !== "demo@onyx.com.vn"
			? [] : DEMO_ITEMS
		const start = (page - 1) * limit
		const paged = filtered.slice(start, start + limit)

		return c.json({
			items: paged,
			totalCount: filtered.length,
			page,
			limit,
		})
	} catch (err) {
		console.error("Error fetching creator content:", err)
		return c.json({ error: "Failed to fetch content" }, 500)
	}
})

// Serve avatar for creator (public, no auth needed)
app.get("/api/v1/creator/:creatorId/avatar", async (c) => {
	try {
		const creatorId = decodeURIComponent(c.req.param("creatorId")!)
		const avatarKey = profileAvatarKey(creatorId)
		const obj = await c.env.BUCKET.get(avatarKey)
		if (!obj) return c.body(null, 404)

		const headers = new Headers()
		headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg")
		headers.set("Cache-Control", "public, max-age=300")
		if (obj.etag) headers.set("ETag", obj.etag)
		return new Response(obj.body, { headers })
	} catch {
		return c.body(null, 404)
	}
})

// Serve cover for creator (public, no auth needed)
app.get("/api/v1/creator/:creatorId/cover", async (c) => {
	try {
		const creatorId = decodeURIComponent(c.req.param("creatorId")!)
		const coverKey = profileCoverKey(creatorId)
		const obj = await c.env.BUCKET.get(coverKey)
		if (!obj) return c.body(null, 404)

		const headers = new Headers()
		headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg")
		headers.set("Cache-Control", "public, max-age=300")
		if (obj.etag) headers.set("ETag", obj.etag)
		return new Response(obj.body, { headers })
	} catch {
		return c.body(null, 404)
	}
})

export { app }
