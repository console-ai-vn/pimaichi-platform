import { Hono } from "hono";
import { z } from "zod";
import {
	assertHomeFeedAdmin,
	assertOrgMemberAccess,
	HomeFeedAccessError,
	sanitizeFeedHtml,
} from "../lib/home-feed-access";
import {
	decodeFeedImageUpload,
	feedCommentImageKey,
	feedTopicImageKey,
} from "../lib/feed-images";
import { htmlToPlainText } from "../lib/feed-text";
import { getOrgFeedStub } from "../lib/org-feed-stub";
import type { AccessVariables, Env } from "../types";

type HomeContext = {
	Bindings: Env;
	Variables: AccessVariables;
};

const homeApp = new Hono<HomeContext>();

const ImageUpload = z.object({
	content: z.string().min(1),
	type: z.string().min(1),
});

const CreateTopicBody = z.object({
	title: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(20_000),
	images: z.array(ImageUpload).max(8).optional(),
});

const CreateCommentBody = z.object({
	body: z.string().trim().min(1).max(5_000),
	images: z.array(ImageUpload).max(4).optional(),
});

const ReactionBody = z.object({
	reaction: z.enum(["like", "dislike"]).nullable(),
});

function handleHomeError(c: { json: (body: unknown, status?: number) => Response }, error: unknown) {
	if (error instanceof HomeFeedAccessError) {
		return c.json({ error: error.message }, 403);
	}
	if (error instanceof Error) {
		return c.json({ error: error.message }, 400);
	}
	return c.json({ error: "Request failed" }, 500);
}

async function storeImages(
	bucket: R2Bucket,
	items: z.infer<typeof ImageUpload>[],
	keyFor: (imageId: string) => string,
) {
	const stored: Array<{
		id: string;
		r2Key: string;
		contentType: string;
		sizeBytes: number;
	}> = [];
	for (const item of items) {
		const decoded = decodeFeedImageUpload(item);
		const id = crypto.randomUUID();
		const r2Key = keyFor(id);
		await bucket.put(r2Key, decoded.bytes, {
			httpMetadata: { contentType: decoded.contentType },
		});
		stored.push({
			id,
			r2Key,
			contentType: decoded.contentType,
			sizeBytes: decoded.bytes.length,
		});
	}
	return stored;
}

homeApp.use("*", async (c, next) => {
	try {
		await assertOrgMemberAccess(c.env, c.var.accessEmail);
	} catch (error) {
		return handleHomeError(c, error);
	}
	await next();
});

homeApp.get("/topics", async (c) => {
	const page = Number(c.req.query("page") || "1");
	const limit = Number(c.req.query("limit") || "20");
	const stub = getOrgFeedStub(c.env);
	const result = await stub.listTopics(page, limit, c.var.accessEmail);
	return c.json(result);
});

homeApp.get("/topics/:topicId", async (c) => {
	const stub = getOrgFeedStub(c.env);
	const topic = await stub.getTopic(c.req.param("topicId")!, c.var.accessEmail);
	if (!topic) return c.json({ error: "Not found" }, 404);
	return c.json(topic);
});

homeApp.post("/topics", async (c) => {
	try {
		await assertHomeFeedAdmin(c.env, c.var.accessEmail);
	} catch (error) {
		return handleHomeError(c, error);
	}

	const body = CreateTopicBody.parse(await c.req.json());
	const bodyHtml = sanitizeFeedHtml(body.body);
	const stub = getOrgFeedStub(c.env);
	const topic = await stub.createTopic(c.var.accessEmail, {
		title: body.title,
		bodyHtml,
		bodyText: htmlToPlainText(bodyHtml),
	});
	if (!topic) return c.json({ error: "Failed to create topic" }, 500);

	if (body.images?.length) {
		const stored = await storeImages(
			c.env.BUCKET,
			body.images,
			(imageId) => feedTopicImageKey(topic.id, imageId),
		);
		await stub.attachTopicImages(
			topic.id,
			stored.map((image) => ({
				id: image.id,
				r2Key: image.r2Key,
				contentType: image.contentType,
				sizeBytes: image.sizeBytes,
			})),
		);
	}

	const refreshed = await stub.getTopic(topic.id, c.var.accessEmail);
	return c.json(refreshed, 201);
});

homeApp.get("/topics/:topicId/comments", async (c) => {
	const page = Number(c.req.query("page") || "1");
	const limit = Number(c.req.query("limit") || "50");
	const stub = getOrgFeedStub(c.env);
	const topic = await stub.getTopic(c.req.param("topicId")!);
	if (!topic) return c.json({ error: "Not found" }, 404);
	const result = await stub.listComments(c.req.param("topicId")!, page, limit);
	return c.json(result);
});

homeApp.post("/topics/:topicId/comments", async (c) => {
	const topicId = c.req.param("topicId")!;
	const body = CreateCommentBody.parse(await c.req.json());
	const bodyHtml = sanitizeFeedHtml(body.body);
	const stub = getOrgFeedStub(c.env);
	const comment = await stub.createComment(topicId, c.var.accessEmail, {
		bodyHtml,
		bodyText: htmlToPlainText(bodyHtml),
	});

	if (body.images?.length) {
		const stored = await storeImages(
			c.env.BUCKET,
			body.images,
			(imageId) => feedCommentImageKey(comment.id, imageId),
		);
		await stub.attachCommentImages(
			comment.id,
			stored.map((image) => ({
				id: image.id,
				r2Key: image.r2Key,
				contentType: image.contentType,
				sizeBytes: image.sizeBytes,
			})),
		);
	}

	const comments = await stub.listComments(topicId, 1, 100);
	const created = comments.comments.find((entry) => entry.id === comment.id);
	return c.json(created ?? comment, 201);
});

homeApp.put("/topics/:topicId/reaction", async (c) => {
	const topicId = c.req.param("topicId")!;
	const { reaction } = ReactionBody.parse(await c.req.json());
	const stub = getOrgFeedStub(c.env);
	try {
		const topic = await stub.setReaction(topicId, c.var.accessEmail, reaction);
		return c.json(topic);
	} catch (error) {
		return handleHomeError(c, error);
	}
});

homeApp.get("/topics/:topicId/images/:imageId", async (c) => {
	const stub = getOrgFeedStub(c.env);
	const image = await stub.getTopicImage(
		c.req.param("topicId")!,
		c.req.param("imageId")!,
	);
	if (!image) return c.body(null, 404);
	const obj = await c.env.BUCKET.get(image.r2_key);
	if (!obj) return c.body(null, 404);
	const headers = new Headers();
	headers.set("Content-Type", image.content_type);
	headers.set("Cache-Control", "public, max-age=300");
	return new Response(obj.body, { headers });
});

homeApp.get("/comments/:commentId/images/:imageId", async (c) => {
	const stub = getOrgFeedStub(c.env);
	const image = await stub.getCommentImage(
		c.req.param("commentId")!,
		c.req.param("imageId")!,
	);
	if (!image) return c.body(null, 404);
	const obj = await c.env.BUCKET.get(image.r2_key);
	if (!obj) return c.body(null, 404);
	const headers = new Headers();
	headers.set("Content-Type", image.content_type);
	headers.set("Cache-Control", "public, max-age=300");
	return new Response(obj.body, { headers });
});

export { homeApp };