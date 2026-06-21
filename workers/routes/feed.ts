// Feed routes for mobile UX — serves seeded content
import { Hono } from "hono"

export const app = new Hono()

// GET /api/v1/feed — following creators' content
app.get("/api/v1/feed", async (c) => {
	const items = [
		{
			id: "post-1",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: "/api/v1/media/placeholder/1",
			imageId: null,
			title: "Buổi sáng mới 🌸",
			tier: "public" as const,
			subscriberCount: 59,
			isNew: true,
			createdAt: new Date().toISOString(),
		},
		{
			id: "post-2",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: "/api/v1/media/placeholder/2",
			imageId: null,
			title: "Dạo phố cùng em 🌆",
			tier: "subscribers" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 3600000).toISOString(),
		},
		{
			id: "post-3",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: "/api/v1/media/placeholder/3",
			imageId: null,
			title: "Bộ ảnh riêng tư: Chỉ dành cho bạn 💜",
			tier: "ppv" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 7200000).toISOString(),
		},
		{
			id: "post-4",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: "/api/v1/media/placeholder/4",
			imageId: null,
			title: "Chiều nay mặc gì? 🛍️",
			tier: "public" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 10800000).toISOString(),
		},
		{
			id: "post-5",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: null,
			imageId: null,
			title: "Cảm ơn 50 subscribers! ❤️",
			tier: "subscribers" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 14400000).toISOString(),
		},
		{
			id: "post-6",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: null,
			imageId: null,
			title: "Video hậu trường: Buổi chụp mới nhất 🎬",
			tier: "ppv" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 18000000).toISOString(),
		},
		{
			id: "post-7",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: "/api/v1/media/placeholder/7",
			imageId: null,
			title: "Q&A: Giải đáp thắc mắc cùng Pimaichi 💬",
			tier: "public" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 21600000).toISOString(),
		},
		{
			id: "post-8",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			creatorAvatarUrl: null,
			thumbnailUrl: null,
			imageId: null,
			title: "Cảm xúc thật: Tâm sự cùng subscribers 🥰",
			tier: "subscribers" as const,
			subscriberCount: 59,
			isNew: false,
			createdAt: new Date(Date.now() - 25200000).toISOString(),
		},
	]

	return c.json({ items, hasMore: false })
})

// GET /api/v1/stories — active stories for demo
app.get("/api/v1/stories", async (c) => {
	const stories = [
		{
			id: "story-1",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			avatarUrl: null,
			imageId: null,
			imageUrl: "/api/v1/media/placeholder/1",
			tier: "public" as const,
			seen: false,
			live: true,
		},
		{
			id: "story-2",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			avatarUrl: null,
			imageId: null,
			imageUrl: "/api/v1/media/placeholder/2",
			tier: "subscribers" as const,
			seen: true,
			live: false,
		},
		{
			id: "story-3",
			creatorId: "pimaichi1003",
			creatorName: "Pimaichi1003",
			avatarUrl: null,
			imageId: null,
			imageUrl: "/api/v1/media/placeholder/3",
			tier: "ppv" as const,
			seen: false,
			live: false,
		},
	]

	return c.json({ stories })
})
