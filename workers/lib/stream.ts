import { SignJWT } from "jose";
import type { Env } from "../types";

const STREAM_API_BASE = "https://api.cloudflare.com/client/v4/accounts";

function getAccountId(env: Env): string {
	const id = env.CF_ACCOUNT_ID;
	if (!id) throw new Error("CF_ACCOUNT_ID is not configured");
	return id;
}

function getStreamToken(env: Env): string {
	const token = env.CF_STREAM_TOKEN;
	if (!token) throw new Error("CF_STREAM_TOKEN is not configured — set via `wrangler secret put CF_STREAM_TOKEN`");
	return token;
}

function getStreamSigningKey(env: Env): string {
	const key = env.CF_STREAM_SIGNING_KEY;
	if (!key) throw new Error("CF_STREAM_SIGNING_KEY is not configured — set via `wrangler secret put CF_STREAM_SIGNING_KEY`");
	return key;
}

async function getSigningKey(env: Env): Promise<CryptoKey> {
	const base64Key = getStreamSigningKey(env);
	const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
}

export async function createDirectUpload(
	env: Env,
	creatorId: string,
): Promise<{ uploadURL: string; uid: string }> {
	const accountId = getAccountId(env);
	const token = getStreamToken(env);

	const res = await fetch(
		`${STREAM_API_BASE}/${accountId}/stream/direct_upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				maxDurationSeconds: 3600,
				meta: { creatorId },
			}),
		},
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Stream direct upload failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: { uploadURL: string; uid: string };
	};
	return { uploadURL: data.result.uploadURL, uid: data.result.uid };
}

export async function getVideoStatus(
	env: Env,
	videoId: string,
): Promise<{
	state: string;
	playback: { hls: string; dash: string };
	thumbnail: string;
	duration: number;
}> {
	const accountId = getAccountId(env);
	const token = getStreamToken(env);

	const res = await fetch(
		`${STREAM_API_BASE}/${accountId}/stream/${videoId}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Stream status failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: {
			status: { state: string };
			playback: { hls: string; dash: string };
			thumbnail: string;
			duration: number;
		};
	};

	return {
		state: data.result.status.state,
		playback: data.result.playback,
		thumbnail: data.result.thumbnail,
		duration: data.result.duration,
	};
}

export async function deleteVideo(env: Env, videoId: string): Promise<void> {
	const accountId = getAccountId(env);
	const token = getStreamToken(env);

	const res = await fetch(
		`${STREAM_API_BASE}/${accountId}/stream/${videoId}`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		},
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Stream delete failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}
}

export async function listVideos(
	env: Env,
	creatorId: string,
): Promise<
	Array<{
		uid: string;
		thumbnail: string;
		status: { state: string };
		duration: number;
		created: string;
	}>
> {
	const accountId = getAccountId(env);
	const token = getStreamToken(env);

	const res = await fetch(
		`${STREAM_API_BASE}/${accountId}/stream?meta.creatorId=${encodeURIComponent(creatorId)}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Stream list failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: Array<{
			uid: string;
			thumbnail: string;
			status: { state: string };
			duration: number;
			created: string;
		}>;
	};

	return data.result;
}

export async function generateSignedToken(
	env: Env,
	videoId: string,
	expirySeconds = 3600,
): Promise<string> {
	const key = await getSigningKey(env);
	const now = Math.floor(Date.now() / 1000);

	const jwt = await new SignJWT({ sub: videoId })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(now)
		.setExpirationTime(now + expirySeconds)
		.sign(key);

	return jwt;
}
