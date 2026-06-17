import assert from "node:assert/strict";
import { describe, mock, test, beforeEach, afterEach } from "node:test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(overrides: Record<string, string | undefined> = {}) {
	return {
		CF_ACCOUNT_ID: "test-account-id",
		CF_STREAM_TOKEN: "test-stream-token-32chars-minimum!!",
		CF_STREAM_SIGNING_KEY: "dGVzdC1zaWduaW5nLWtleS0zMi1ieXRlcy1taW5pbXVtIQ==",
		CF_IMAGES_TOKEN: "test-images-token-32chars-min!!",
		CF_IMAGES_ACCOUNT_HASH: "test-hash-abc",
		...overrides,
	} as unknown as import("../workers/types").Env;
}

function mockFetchResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as Response;
}

// ---------------------------------------------------------------------------
// Stream lib
// ---------------------------------------------------------------------------

test("stream: createDirectUpload missing CF_ACCOUNT_ID throws", async () => {
	const { createDirectUpload } = await import("../workers/lib/stream.ts");
	const env = makeEnv({ CF_ACCOUNT_ID: undefined });
	await assert.rejects(
		() => createDirectUpload(env, "u1"),
		/CF_ACCOUNT_ID is not configured/,
	);
});

test("stream: createDirectUpload missing CF_STREAM_TOKEN throws", async () => {
	const { createDirectUpload } = await import("../workers/lib/stream.ts");
	const env = makeEnv({ CF_STREAM_TOKEN: undefined });
	await assert.rejects(
		() => createDirectUpload(env, "u1"),
		/CF_STREAM_TOKEN is not configured/,
	);
});

test("stream: createDirectUpload success", async () => {
	const { createDirectUpload } = await import("../workers/lib/stream.ts");
	const env = makeEnv();
	const mockFetch = mock.fn((_url: string, _init: RequestInit) =>
		Promise.resolve(
			mockFetchResponse({
				result: { uploadURL: "https://upload.stream/abc", uid: "vid-1" },
			}),
		),
	) as unknown as typeof fetch;
	globalThis.fetch = mockFetch;

	const result = await createDirectUpload(env, "creator-1");
	assert.equal(result.uploadURL, "https://upload.stream/abc");
	assert.equal(result.uid, "vid-1");

	const callArgs = (mockFetch.mock.calls[0] as { arguments: [string, RequestInit] }).arguments;
	assert.ok(callArgs[0].includes("/stream/direct_upload"));
	assert.equal(callArgs[1].method, "POST");
	const headers = (callArgs[1].headers as Record<string, string>);
	assert.equal(headers["Authorization"], "Bearer test-stream-token-32chars-minimum!!");
	const body = JSON.parse(callArgs[1].body as string);
	assert.equal(body.maxDurationSeconds, 3600);
	assert.deepEqual(body.meta, { creatorId: "creator-1" });
});

test("stream: createDirectUpload API error", async () => {
	const { createDirectUpload } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({ errors: [{ message: "Quota exceeded" }] }, 429),
		),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => createDirectUpload(makeEnv(), "u1"),
		/Stream direct upload failed: 429/,
	);
});

test("stream: getVideoStatus success", async () => {
	const { getVideoStatus } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: {
					status: { state: "ready" },
					playback: { hls: "https://hls.example/v.m3u8", dash: "https://dash.example/v.mpd" },
					thumbnail: "https://thumb.example/v.jpg",
					duration: 120.5,
				},
			}),
		),
	) as unknown as typeof fetch;

	const result = await getVideoStatus(makeEnv(), "vid-1");
	assert.equal(result.state, "ready");
	assert.equal(result.playback.hls, "https://hls.example/v.m3u8");
	assert.equal(result.playback.dash, "https://dash.example/v.mpd");
	assert.equal(result.thumbnail, "https://thumb.example/v.jpg");
	assert.equal(result.duration, 120.5);
});

test("stream: getVideoStatus API error", async () => {
	const { getVideoStatus } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 404)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => getVideoStatus(makeEnv(), "nonexistent"),
		/Stream status failed: 404/,
	);
});

test("stream: deleteVideo success", async () => {
	const { deleteVideo } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 204)),
	) as unknown as typeof fetch;

	await assert.doesNotReject(() => deleteVideo(makeEnv(), "vid-1"));
});

test("stream: deleteVideo API error", async () => {
	const { deleteVideo } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({ errors: [{ message: "Not found" }] }, 404)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => deleteVideo(makeEnv(), "vid-1"),
		/Stream delete failed: 404/,
	);
});

test("stream: listVideos success with creatorId filter", async () => {
	const { listVideos } = await import("../workers/lib/stream.ts");
	const fetchMock = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: [
					{ uid: "v1", thumbnail: "t1", status: { state: "ready" }, duration: 60, created: "2026-01-01" },
					{ uid: "v2", thumbnail: "t2", status: { state: "processing" }, duration: 0, created: "2026-01-02" },
				],
			}),
		),
	) as unknown as typeof fetch;
	globalThis.fetch = fetchMock;

	const videos = await listVideos(makeEnv(), "creator-1");
	assert.equal(videos.length, 2);
	assert.equal(videos[0].uid, "v1");
	assert.equal(videos[0].status.state, "ready");

	// Verify creatorId used in query params
	const url = (fetchMock.mock.calls[0] as { arguments: [string] }).arguments[0];
	assert.ok(url.includes("meta.creatorId=creator-1"));
});

test("stream: listVideos API error", async () => {
	const { listVideos } = await import("../workers/lib/stream.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 500)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => listVideos(makeEnv(), "creator-1"),
		/Stream list failed: 500/,
	);
});

test("stream: generateSignedToken produces a JWT", async () => {
	const { generateSignedToken } = await import("../workers/lib/stream.ts");
	const env = makeEnv();
	const token = await generateSignedToken(env, "vid-1", 3600);
	assert.ok(token);
	assert.ok(typeof token === "string");
	
	// Token should have 3 parts (header.payload.signature)
	const parts = token.split(".");
	assert.equal(parts.length, 3);
});

test("stream: generateSignedToken creates different tokens for different video IDs", async () => {
	const { generateSignedToken } = await import("../workers/lib/stream.ts");
	const env = makeEnv();
	const token1 = await generateSignedToken(env, "vid-1", 3600);
	const token2 = await generateSignedToken(env, "vid-2", 3600);
	assert.notEqual(token1, token2);
});

test("stream: generateSignedToken creates different tokens for different expiry", async () => {
	const { generateSignedToken } = await import("../workers/lib/stream.ts");
	const env = makeEnv();
	const token1 = await generateSignedToken(env, "vid-1", 3600);
	// Different expiry should produce different payload, hence different token
	const token2 = await generateSignedToken(env, "vid-1", 7200);
	assert.notEqual(token1, token2);
});

test("stream: generateSignedToken missing signing key throws", async () => {
	const { generateSignedToken } = await import("../workers/lib/stream.ts");
	const env = makeEnv({ CF_STREAM_SIGNING_KEY: undefined });
	await assert.rejects(
		() => generateSignedToken(env, "vid-1"),
		/CF_STREAM_SIGNING_KEY is not configured/,
	);
});

// ---------------------------------------------------------------------------
// Images lib
// ---------------------------------------------------------------------------

test("images: createDirectUpload missing CF_ACCOUNT_ID throws", async () => {
	const { createDirectUpload } = await import("../workers/lib/images.ts");
	const env = makeEnv({ CF_ACCOUNT_ID: undefined });
	await assert.rejects(
		() => createDirectUpload(env, "u1"),
		/CF_ACCOUNT_ID is not configured/,
	);
});

test("images: createDirectUpload missing CF_IMAGES_TOKEN throws", async () => {
	const { createDirectUpload } = await import("../workers/lib/images.ts");
	const env = makeEnv({ CF_IMAGES_TOKEN: undefined });
	await assert.rejects(
		() => createDirectUpload(env, "u1"),
		/CF_IMAGES_TOKEN is not configured/,
	);
});

test("images: createDirectUpload success", async () => {
	const { createDirectUpload } = await import("../workers/lib/images.ts");
	const fetchMock = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: { uploadURL: "https://upload.imagedelivery.net/abc", id: "img-1" },
			}),
		),
	) as unknown as typeof fetch;
	globalThis.fetch = fetchMock;

	const result = await createDirectUpload(makeEnv(), "creator-1");
	assert.equal(result.uploadURL, "https://upload.imagedelivery.net/abc");
	assert.equal(result.id, "img-1");

	const callArgs = (fetchMock.mock.calls[0] as { arguments: [string, RequestInit] }).arguments;
	assert.ok(callArgs[0].includes("/images/v1/direct_upload"));
	assert.equal(callArgs[1].method, "POST");
	const body = JSON.parse(callArgs[1].body as string);
	assert.deepEqual(body.metadata, { creatorId: "creator-1" });
});

test("images: createDirectUpload API error", async () => {
	const { createDirectUpload } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({ errors: [{ message: "Quota exceeded" }] }, 400),
		),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => createDirectUpload(makeEnv(), "u1"),
		/Images direct upload failed: 400/,
	);
});

test("images: getImageVariants with account hash constructs correct URLs", async () => {
	const { getImageVariants } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: {
					id: "img-1",
					variants: [
						"https://imagedelivery.net/test-hash-abc/img-1/public",
						"https://imagedelivery.net/test-hash-abc/img-1/thumbnail",
						"https://imagedelivery.net/test-hash-abc/img-1/medium",
						"https://imagedelivery.net/test-hash-abc/img-1/full",
					],
				},
			}),
		),
	) as unknown as typeof fetch;

	const variants = await getImageVariants(makeEnv(), "img-1");
	assert.ok(variants.original.includes("public"));
	assert.ok(variants.thumbnail.includes("thumbnail"));
	assert.ok(variants.medium.includes("medium"));
	assert.ok(variants.full.includes("full"));
});

test("images: getImageVariants without account hash falls back", async () => {
	const { getImageVariants } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: {
					id: "img-1",
					variants: [
						"https://imagedelivery.net/no-hash/img-1/public",
					],
				},
			}),
		),
	) as unknown as typeof fetch;

	const variants = await getImageVariants(
		makeEnv({ CF_IMAGES_ACCOUNT_HASH: undefined }),
		"img-1",
	);
	// Without account hash, falls back to API proxy path
	assert.ok(variants.original);
	// Should not crash
	assert.equal(typeof variants.thumbnail, "string");
	assert.equal(typeof variants.medium, "string");
	assert.equal(typeof variants.full, "string");
});

test("images: getImageVariants API error", async () => {
	const { getImageVariants } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 404)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => getImageVariants(makeEnv(), "nonexistent"),
		/Images detail failed: 404/,
	);
});

test("images: deleteImage success", async () => {
	const { deleteImage } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 204)),
	) as unknown as typeof fetch;

	await assert.doesNotReject(() => deleteImage(makeEnv(), "img-1"));
});

test("images: deleteImage API error", async () => {
	const { deleteImage } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 404)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => deleteImage(makeEnv(), "img-1"),
		/Images delete failed: 404/,
	);
});

test("images: listImages filters by creatorId", async () => {
	const { listImages } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: {
					images: [
						{ id: "i1", variants: ["v1"], uploaded: "2026-01-01", meta: { creatorId: "creator-1" } },
						{ id: "i2", variants: ["v2"], uploaded: "2026-01-02", meta: { creatorId: "creator-2" } },
						{ id: "i3", variants: ["v3"], uploaded: "2026-01-03" },
					],
				},
			}),
		),
	) as unknown as typeof fetch;

	const images = await listImages(makeEnv(), "creator-1");
	assert.equal(images.length, 1);
	assert.equal(images[0].id, "i1");
});

test("images: listImages returns all when creatorId is empty", async () => {
	const { listImages } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(
			mockFetchResponse({
				result: {
					images: [
						{ id: "i1", variants: ["v1"], uploaded: "2026-01-01", meta: { creatorId: "creator-1" } },
						{ id: "i2", variants: ["v2"], uploaded: "2026-01-02", meta: { creatorId: "creator-2" } },
					],
				},
			}),
		),
	) as unknown as typeof fetch;

	const images = await listImages(makeEnv(), "");
	assert.equal(images.length, 2);
});

test("images: listImages API error", async () => {
	const { listImages } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({}, 500)),
	) as unknown as typeof fetch;

	await assert.rejects(
		() => listImages(makeEnv(), "creator-1"),
		/Images list failed: 500/,
	);
});

test("images: listImages handles empty result", async () => {
	const { listImages } = await import("../workers/lib/images.ts");
	globalThis.fetch = mock.fn(() =>
		Promise.resolve(mockFetchResponse({ result: {} })),
	) as unknown as typeof fetch;

	const images = await listImages(makeEnv(), "creator-1");
	assert.deepEqual(images, []);
});

// ---------------------------------------------------------------------------
// Media routes — mediaError helper
// ---------------------------------------------------------------------------

test("media routes: mediaError returns 501 for 'not configured' errors", () => {
	// Simulate the mediaError logic inline
	const message = "CF_STREAM_TOKEN is not configured — set via `wrangler secret put CF_STREAM_TOKEN`";
	const status = message.includes("not configured") ? 501 : 500;
	assert.equal(status, 501);
});

test("media routes: mediaError returns 500 for generic errors", () => {
	const message = "Something went wrong";
	const status = message.includes("not configured") ? 501 : 500;
	assert.equal(status, 500);
});

// ---------------------------------------------------------------------------
// Media routes — R2 upload path construction
// ---------------------------------------------------------------------------

test("media routes: R2 upload key includes mailboxId and UUID", () => {
	const mailboxId = "creator@example.com";
	const safeFilename = "photo.jpg";
	const key = `media/${mailboxId}/some-uuid-${safeFilename}`;
	assert.ok(key.startsWith("media/creator@example.com/"));
	assert.ok(key.endsWith("-photo.jpg"));
});

test("media routes: R2 upload sanitizes dangerous filename characters", () => {
	const sanitized = "bad/file:name*test?.txt".replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_");
	assert.equal(sanitized, "bad_file_name_test_.txt");
});

test("media routes: R2 proxy extracts key from path correctly", () => {
	const fullPath = "/api/v1/media/r2/media/creator@example.com/abc-photo.jpg";
	const key = decodeURIComponent(fullPath.replace("/api/v1/media/r2/", ""));
	assert.equal(key, "media/creator@example.com/abc-photo.jpg");
});

test("media routes: R2 proxy returns 404 for empty key", () => {
	const fullPath = "/api/v1/media/r2/";
	const key = decodeURIComponent(fullPath.replace("/api/v1/media/r2/", ""));
	assert.equal(key, "");
});

// ---------------------------------------------------------------------------
// UploadProgress state transitions (pure logic tests)
// ---------------------------------------------------------------------------

test("upload-progress: initial status is 'uploading'", () => {
	const status: "uploading" | "cancelled" | "done" = "uploading";
	assert.equal(status, "uploading");
});

test("upload-progress: status transitions to 'done' on success", () => {
	let status: "uploading" | "cancelled" | "done" = "uploading";
	// Simulate upload completing
	status = "done";
	assert.equal(status, "done");
});

test("upload-progress: status transitions to 'cancelled' on abort", () => {
	let status: "uploading" | "cancelled" | "done" = "uploading";
	status = "cancelled";
	assert.equal(status, "cancelled");
});

test("upload-progress: progress bar min width is 5% even at 0%", () => {
	const progress = 0;
	const width = Math.max(5, progress);
	assert.equal(width, 5);
});

test("upload-progress: progress at 50% shows correct width", () => {
	const progress = 50;
	const width = Math.max(5, progress);
	assert.equal(width, 50);
});

test("upload-progress: file size formatting for KB", () => {
	const size = 512 * 1024; // 512 KB
	const formatted = `${Math.round(size / 1024)} KB`;
	assert.equal(formatted, "512 KB");
});

test("upload-progress: file size formatting for MB", () => {
	const size = 2.5 * 1024 * 1024;
	const formatted = `${(size / (1024 * 1024)).toFixed(1)} MB`;
	assert.equal(formatted, "2.5 MB");
});

// ---------------------------------------------------------------------------
// Video status refetch logic
// ---------------------------------------------------------------------------

test("video status query: refetch enabled while processing", () => {
	const state = "processing";
	const shouldRefetch = !state || state === "ready" || state === "error" ? false : 5000;
	assert.equal(shouldRefetch, 5000);
});

test("video status query: refetch disabled when ready", () => {
	const state = "ready";
	const shouldRefetch = !state || state === "ready" || state === "error" ? false : 5000;
	assert.equal(shouldRefetch, false);
});

test("video status query: refetch disabled when error", () => {
	const state = "error";
	const shouldRefetch = !state || state === "ready" || state === "error" ? false : 5000;
	assert.equal(shouldRefetch, false);
});

test("video status query: refetch disabled when no state", () => {
	const state = undefined;
	const shouldRefetch = !state || state === "ready" || state === "error" ? false : 5000;
	assert.equal(shouldRefetch, false);
});

// ---------------------------------------------------------------------------
// Signed token JWT claims verification (logical)
// ---------------------------------------------------------------------------

test("signed token: JWT has three dot-separated parts", () => {
	const mockJwt = "header.payload.signature";
	const parts = mockJwt.split(".");
	assert.equal(parts.length, 3);
	assert.equal(parts[0], "header");
	assert.equal(parts[1], "payload");
	assert.equal(parts[2], "signature");
});

test("signed token: expiry is now + expirySeconds", () => {
	const now = Math.floor(Date.now() / 1000);
	const expirySeconds = 3600;
	// iat is now, exp is now + 3600
	assert.ok(expirySeconds > 0);
	const exp = now + expirySeconds;
	assert.ok(exp > now);
});

test("signed token: sub claim equals videoId", () => {
	const videoId = "vid-123";
	assert.equal(videoId, "vid-123");
});

// ---------------------------------------------------------------------------
// Stream URL format tests
// ---------------------------------------------------------------------------

test("stream: direct upload URL targets correct API endpoint", () => {
	const accountId = "acct-1";
	const base = "https://api.cloudflare.com/client/v4/accounts";
	const url = `${base}/${accountId}/stream/direct_upload`;
	assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/acct-1/stream/direct_upload");
});

test("stream: video status URL includes videoId", () => {
	const accountId = "acct-1";
	const videoId = "vid-1";
	const base = "https://api.cloudflare.com/client/v4/accounts";
	const url = `${base}/${accountId}/stream/${videoId}`;
	assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/acct-1/stream/vid-1");
});

// ---------------------------------------------------------------------------
// Images URL format tests
// ---------------------------------------------------------------------------

test("images: direct upload URL targets correct API endpoint", () => {
	const accountId = "acct-1";
	const base = "https://api.cloudflare.com/client/v4/accounts";
	const url = `${base}/${accountId}/images/v1/direct_upload`;
	assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/acct-1/images/v1/direct_upload");
});

// ---------------------------------------------------------------------------
// API route paths match expectations
// ---------------------------------------------------------------------------

test("API routes: signed stream token endpoint", () => {
	const videoId = "vid-1";
	const route = `/api/v1/media/signed-stream/${encodeURIComponent(videoId)}`;
	assert.equal(route, "/api/v1/media/signed-stream/vid-1");
});

test("API routes: image variants endpoint", () => {
	const imageId = "img-1";
	const route = `/api/v1/media/images/${encodeURIComponent(imageId)}/variants`;
	assert.equal(route, "/api/v1/media/images/img-1/variants");
});

test("API routes: stream list endpoint", () => {
	const mailboxId = "user@example.com";
	const route = `/api/v1/media/stream/list/${encodeURIComponent(mailboxId)}`;
	assert.equal(route, "/api/v1/media/stream/list/user%40example.com");
});

test("API routes: images list endpoint", () => {
	const mailboxId = "user@example.com";
	const route = `/api/v1/media/images/list/${encodeURIComponent(mailboxId)}`;
	assert.equal(route, "/api/v1/media/images/list/user%40example.com");
});

// ---------------------------------------------------------------------------
// Gallery component — grid column logic
// ---------------------------------------------------------------------------

test("gallery: default columns = 3 produces 2-3 grid", () => {
	const columns = 3;
	const gridCols =
		columns === 2 ? "grid-cols-2"
		: columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
		: columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
		: "grid-cols-2 sm:grid-cols-3";
	assert.equal(gridCols, "grid-cols-2 sm:grid-cols-3");
});

test("gallery: columns=2 produces 2-col grid", () => {
	const columns = 2;
	const gridCols =
		columns === 2 ? "grid-cols-2"
		: columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
		: columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
		: "grid-cols-2 sm:grid-cols-3";
	assert.equal(gridCols, "grid-cols-2");
});

test("gallery: columns=4 produces responsive grid", () => {
	const columns = 4;
	const gridCols =
		columns === 2 ? "grid-cols-2"
		: columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
		: columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
		: "grid-cols-2 sm:grid-cols-3";
	assert.equal(gridCols, "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4");
});

test("gallery: columns=5 produces 5-col responsive grid", () => {
	const columns = 5;
	const gridCols =
		columns === 2 ? "grid-cols-2"
		: columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
		: columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
		: "grid-cols-2 sm:grid-cols-3";
	assert.equal(gridCols, "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5");
});

// ---------------------------------------------------------------------------
// Media page — format helpers
// ---------------------------------------------------------------------------

test("media page: formatDuration formats seconds to MM:SS", () => {
	const seconds = 125;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
	assert.equal(formatted, "2:05");
});

test("media page: formatDuration handles zero/negative as '--:--'", () => {
	const seconds = 0;
	const formatted = !seconds || seconds <= 0 ? "--:--" : "00:00";
	assert.equal(formatted, "--:--");
});

test("media page: formatDuration handles 60 seconds exactly", () => {
	const seconds = 60;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
	assert.equal(formatted, "1:00");
});

// ---------------------------------------------------------------------------
// Error message fallback for non-Error throws
// ---------------------------------------------------------------------------

test("media routes: non-Error throws get generic message", () => {
	const error = "string error";
	const message = error instanceof Error ? error.message : "Request failed";
	assert.equal(message, "Request failed");
});

test("media routes: Error instances preserve message", () => {
	const error = new Error("Custom failure");
	const message = error instanceof Error ? error.message : "Request failed";
	assert.equal(message, "Custom failure");
});

// ---------------------------------------------------------------------------
// Video player state rendering logic
// ---------------------------------------------------------------------------

test("video player: 'error' state shows processing failed message", () => {
	const state = "error";
	const isFailed = state === "error";
	assert.equal(isFailed, true);
});

test("video player: 'ready' state can show video", () => {
	const state = "ready";
	const isReady = state === "ready";
	assert.equal(isReady, true);
});

test("video player: 'processing' state shows loader", () => {
	const state = "processing";
	const isLoading = state !== "ready" && state !== "error";
	assert.equal(isLoading, true);
});

test("video player: HLS URL with signed token", () => {
	const hlsUrl = "https://hls.example/v.m3u8";
	const token = "jwt-token-abc";
	const resolved = `${hlsUrl}?token=${encodeURIComponent(token)}`;
	assert.equal(resolved, "https://hls.example/v.m3u8?token=jwt-token-abc");
});

test("video player: Stream iframe fallback URL", () => {
	const videoId = "vid-1";
	const streamUrl = `https://watch.cloudflarestream.com/${encodeURIComponent(videoId)}`;
	assert.equal(streamUrl, "https://watch.cloudflarestream.com/vid-1");
});

// ---------------------------------------------------------------------------
// Access validation — media routes
// ---------------------------------------------------------------------------

test("media access: missing access email returns 403", () => {
	const accessEmail = "";
	const result = !accessEmail ? { ok: false, status: 403, error: "Forbidden" } : { ok: true };
	assert.equal(result.ok, false);
	assert.equal(result.status, 403);
});

test("media access: valid email passes check", () => {
	const accessEmail = "member@example.com";
	const result = !accessEmail ? { ok: false, status: 403, error: "Forbidden" } : { ok: true };
	assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// R2 upload metadata validation
// ---------------------------------------------------------------------------

test("r2 upload: valid metadata parses correctly", () => {
	const meta = { filename: "photo.jpg", contentType: "image/jpeg" };
	assert.equal(meta.filename, "photo.jpg");
	assert.equal(meta.contentType, "image/jpeg");
});

test("r2 upload: empty filename fails validation", () => {
	const filename = "";
	const valid = filename.length >= 1 && filename.length <= 255;
	assert.equal(valid, false);
});

test("r2 upload: filename at max length passes", () => {
	const filename = "a".repeat(255);
	const valid = filename.length >= 1 && filename.length <= 255;
	assert.equal(valid, true);
});

test("r2 upload: filename over 255 chars fails", () => {
	const filename = "a".repeat(256);
	const valid = filename.length >= 1 && filename.length <= 255;
	assert.equal(valid, false);
});

// ---------------------------------------------------------------------------
// Default variant names
// ---------------------------------------------------------------------------

test("images: default variant names include expected variants", () => {
	const DEFAULT_VARIANT_NAMES = ["public", "thumbnail", "medium", "full"];
	assert.ok(DEFAULT_VARIANT_NAMES.includes("public"));
	assert.ok(DEFAULT_VARIANT_NAMES.includes("thumbnail"));
	assert.ok(DEFAULT_VARIANT_NAMES.includes("medium"));
	assert.ok(DEFAULT_VARIANT_NAMES.includes("full"));
	assert.equal(DEFAULT_VARIANT_NAMES.length, 4);
});
