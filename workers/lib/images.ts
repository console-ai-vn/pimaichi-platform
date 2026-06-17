import type { Env } from "../types";

const IMAGES_API_BASE = "https://api.cloudflare.com/client/v4/accounts";

function getAccountId(env: Env): string {
	const id = env.CF_ACCOUNT_ID;
	if (!id) throw new Error("CF_ACCOUNT_ID is not configured");
	return id;
}

function getImagesToken(env: Env): string {
	const token = env.CF_IMAGES_TOKEN;
	if (!token) throw new Error("CF_IMAGES_TOKEN is not configured — set via `wrangler secret put CF_IMAGES_TOKEN`");
	return token;
}

const DEFAULT_VARIANT_NAMES = ["public", "thumbnail", "medium", "full"];

export async function createDirectUpload(
	env: Env,
	creatorId: string,
): Promise<{ uploadURL: string; id: string }> {
	const accountId = getAccountId(env);
	const token = getImagesToken(env);

	const res = await fetch(
		`${IMAGES_API_BASE}/${accountId}/images/v1/direct_upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				metadata: { creatorId },
			}),
		},
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Images direct upload failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: { uploadURL: string; id: string };
	};
	return { uploadURL: data.result.uploadURL, id: data.result.id };
}

export async function getImageVariants(
	env: Env,
	imageId: string,
): Promise<{
	original: string;
	thumbnail: string;
	medium: string;
	full: string;
}> {
	const accountId = getAccountId(env);
	const token = getImagesToken(env);
	const accountHash = env.CF_IMAGES_ACCOUNT_HASH;

	const res = await fetch(
		`${IMAGES_API_BASE}/${accountId}/images/v1/${imageId}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Images detail failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: {
			id: string;
			variants: string[];
		};
	};

	const result = data.result;
	const variantUrls: Record<string, string> = {};

	// Cloudflare Images returns variant URLs in the format:
	// https://imagedelivery.net/{accountHash}/{imageId}/{variant}
	// If accountHash is configured, build variant URLs
	if (accountHash && result.variants?.length) {
		for (const variantUrl of result.variants) {
			// Extract variant name from URL
			const match = variantUrl.match(/\/([^/]+)$/);
			if (match) {
				variantUrls[match[1]] = variantUrl;
			}
		}
	} else {
		// Fallback: use result.variants directly or build from account hash
		for (const name of DEFAULT_VARIANT_NAMES) {
			const cfUrl = accountHash ? `https://imagedelivery.net/${accountHash}/${imageId}/${name}` : null;
		const variant = cfUrl || result.variants?.find((v) => v.includes(name)) || "";
		variantUrls[name] = variant;
		}
	}

	return {
		original: variantUrls["public"] || variantUrls["original"] || result.variants?.[0] || "",
		thumbnail: variantUrls["thumbnail"] || variantUrls["public"] || "",
		medium: variantUrls["medium"] || variantUrls["public"] || "",
		full: variantUrls["full"] || variantUrls["public"] || "",
	};
}

export async function deleteImage(env: Env, imageId: string): Promise<void> {
	const accountId = getAccountId(env);
	const token = getImagesToken(env);

	const res = await fetch(
		`${IMAGES_API_BASE}/${accountId}/images/v1/${imageId}`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		},
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Images delete failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}
}

export async function listImages(
	env: Env,
	creatorId: string,
): Promise<
	Array<{
		id: string;
		variants: string[];
		uploaded: string;
	}>
> {
	const accountId = getAccountId(env);
	const token = getImagesToken(env);

	// Note: Cloudflare Images v1 list endpoint does not support metadata filtering natively.
	// We fetch all images and filter by metadata.creatorId client-side.
	const res = await fetch(
		`${IMAGES_API_BASE}/${accountId}/images/v1?per_page=100`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			`Images list failed: ${res.status} ${JSON.stringify(err)}`,
		);
	}

	const data = (await res.json()) as {
		result: {
			images: Array<{
				id: string;
				variants: string[];
				uploaded: string;
				meta?: Record<string, string>;
			}>;
		};
	};

	const images = data.result.images ?? [];
	return images
		.filter((img) => !creatorId || img.meta?.creatorId === creatorId)
		.map((img) => ({
			id: img.id,
			variants: img.variants,
			uploaded: img.uploaded,
		}));
}
