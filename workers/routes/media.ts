import { Hono } from "hono";
import { z } from "zod";
import { normalizeEmail } from "../lib/access";
import { isOrgMember } from "../lib/home-feed-access";
import { getDomainConfig } from "../lib/admin";
import {
	createDirectUpload as createStreamDirectUpload,
	getVideoStatus as getStreamVideoStatus,
	deleteVideo as deleteStreamVideo,
	listVideos as listStreamVideos,
	generateSignedToken,
} from "../lib/stream";
import {
	createDirectUpload as createImagesDirectUpload,
	getImageVariants,
	deleteImage as deleteImagesImage,
	listImages as listImagesLibrary,
} from "../lib/images";
import type { AccessVariables, Env } from "../types";

type MediaContext = {
	Bindings: Env;
	Variables: AccessVariables;
};

const app = new Hono<MediaContext>();

// --- Access validation for media routes ---
async function assertOrgMemberMediaAccess(
	env: Env,
	accessEmail: string,
	mailboxId: string,
) {
	const normalizedMailboxId = normalizeEmail(decodeURIComponent(mailboxId));
	if (!accessEmail) {
		return { ok: false as const, status: 403 as const, error: "Forbidden" };
	}

	const config = await getDomainConfig(env);
	if (!isOrgMember(accessEmail, config)) {
		return { ok: false as const, status: 403 as const, error: "Forbidden" };
	}

	return { ok: true as const, mailboxId: normalizedMailboxId };
}

function mediaError(c: { json: (body: unknown, status?: number) => Response }, error: unknown) {
	const message = error instanceof Error ? error.message : "Request failed";
	const status = message.includes("not configured") ? 501 : 500;
	return c.json({ error: message }, status);
}

// --- Stream routes ---

// POST /api/v1/media/upload/stream/init
app.post("/api/v1/media/upload/stream/init", async (c) => {
	try {
		const { mailboxId } = await c.req.json() as { mailboxId?: string };
		if (!mailboxId) return c.json({ error: "mailboxId required" }, 400);

		const access = await assertOrgMemberMediaAccess(c.env, c.var.accessEmail, mailboxId);
		if (!access.ok) return c.json({ error: access.error }, access.status);

		const result = await createStreamDirectUpload(c.env, access.mailboxId);
		return c.json(result);
	} catch (error) {
		return mediaError(c, error);
	}
});

// GET /api/v1/media/stream/:videoId/status
app.get("/api/v1/media/stream/:videoId/status", async (c) => {
	try {
		const videoId = c.req.param("videoId")!;
		const result = await getStreamVideoStatus(c.env, videoId);
		return c.json(result);
	} catch (error) {
		return mediaError(c, error);
	}
});

// DELETE /api/v1/media/stream/:videoId
app.delete("/api/v1/media/stream/:videoId", async (c) => {
	try {
		const videoId = c.req.param("videoId")!;
		await deleteStreamVideo(c.env, videoId);
		return c.body(null, 204);
	} catch (error) {
		return mediaError(c, error);
	}
});

// GET /api/v1/media/stream/list/:mailboxId
app.get("/api/v1/media/stream/list/:mailboxId", async (c) => {
	try {
		const mailboxId = c.req.param("mailboxId")!;
		const access = await assertOrgMemberMediaAccess(
			c.env,
			c.var.accessEmail,
			mailboxId,
		);
		if (!access.ok) return c.json({ error: access.error }, access.status);

		const videos = await listStreamVideos(c.env, access.mailboxId);
		return c.json(videos);
	} catch (error) {
		return mediaError(c, error);
	}
});

// --- Images routes ---

// POST /api/v1/media/upload/images/init
app.post("/api/v1/media/upload/images/init", async (c) => {
	try {
		const { mailboxId } = await c.req.json() as { mailboxId?: string };
		if (!mailboxId) return c.json({ error: "mailboxId required" }, 400);

		const access = await assertOrgMemberMediaAccess(c.env, c.var.accessEmail, mailboxId);
		if (!access.ok) return c.json({ error: access.error }, access.status);

		const result = await createImagesDirectUpload(c.env, access.mailboxId);
		return c.json(result);
	} catch (error) {
		return mediaError(c, error);
	}
});

// GET /api/v1/media/images/:imageId/variants
app.get("/api/v1/media/images/:imageId/variants", async (c) => {
	try {
		const imageId = c.req.param("imageId")!;
		const variants = await getImageVariants(c.env, imageId);
		return c.json(variants);
	} catch (error) {
		return mediaError(c, error);
	}
});

// DELETE /api/v1/media/images/:imageId
app.delete("/api/v1/media/images/:imageId", async (c) => {
	try {
		const imageId = c.req.param("imageId")!;
		await deleteImagesImage(c.env, imageId);
		return c.body(null, 204);
	} catch (error) {
		return mediaError(c, error);
	}
});

// GET /api/v1/media/images/list/:mailboxId
app.get("/api/v1/media/images/list/:mailboxId", async (c) => {
	try {
		const mailboxId = c.req.param("mailboxId")!;
		const access = await assertOrgMemberMediaAccess(
			c.env,
			c.var.accessEmail,
			mailboxId,
		);
		if (!access.ok) return c.json({ error: access.error }, access.status);

		const images = await listImagesLibrary(c.env, access.mailboxId);
		return c.json(images);
	} catch (error) {
		return mediaError(c, error);
	}
});

// --- R2 fallback upload ---

const R2UploadMeta = z.object({
	filename: z.string().min(1).max(255),
	contentType: z.string().min(1),
});

// POST /api/v1/media/upload/r2
app.post("/api/v1/media/upload/r2", async (c) => {
	const accessEmail = c.var.accessEmail;
	if (!accessEmail) return c.json({ error: "Forbidden" }, 403);

	const mailboxId = normalizeEmail(accessEmail);
	const formData = await c.req.formData();
	const file = formData.get("file");
	const metaRaw = formData.get("meta");

	if (!file || !(file instanceof File)) {
		return c.json({ error: "Missing file" }, 400);
	}

	let meta: { filename: string; contentType: string };
	try {
		meta = R2UploadMeta.parse(
			metaRaw ? JSON.parse(metaRaw as string) : { filename: file.name || "upload", contentType: file.type || "application/octet-stream" },
		);
	} catch {
		return c.json({ error: "Invalid metadata" }, 400);
	}

	const safeFilename = meta.filename.replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_");
	const key = `media/${mailboxId}/${crypto.randomUUID()}-${safeFilename}`;

	await c.env.BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType: meta.contentType },
	});

	const url = `/api/v1/media/r2/${encodeURIComponent(key)}`;
	return c.json({ key, url, filename: safeFilename }, 201);
});

// GET /api/v1/media/r2/*
app.get("/api/v1/media/r2/*", async (c) => {
	const fullPath = new URL(c.req.url).pathname;
	const key = decodeURIComponent(fullPath.replace("/api/v1/media/r2/", ""));
	if (!key) return c.body(null, 404);

	const obj = await c.env.BUCKET.get(key);
	if (!obj) return c.body(null, 404);

	const headers = new Headers();
	if (obj.httpMetadata?.contentType) {
		headers.set("Content-Type", obj.httpMetadata.contentType);
	}
	headers.set("Cache-Control", "public, max-age=3600");
	if (obj.etag) headers.set("ETag", obj.etag);

	return new Response(obj.body, { headers });
});

// --- Signed Stream token ---

// GET /api/v1/media/signed-stream/:videoId
app.get("/api/v1/media/signed-stream/:videoId", async (c) => {
	try {
		const accessEmail = c.var.accessEmail;
		if (!accessEmail) return c.json({ error: "Forbidden" }, 403);

		const videoId = c.req.param("videoId")!;
		const expiry = Number(c.req.query("expiry") || "3600");

		const token = await generateSignedToken(c.env, videoId, expiry);
		return c.json({ token });
	} catch (error) {
		return mediaError(c, error);
	}
});

export { app };
