// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * NSFW image scanning stub.
 *
 * TODO: Integrate with Cloudflare Images NSFW classification API
 * when available. CF Images provides a moderation endpoint that
 * classifies images into safe/nsfw categories with a confidence score.
 *
 * For now, always returns { safe: true } — no actual scanning is performed.
 *
 * Future integration:
 * 1. Accept the image's CF Images ID or URL
 * 2. Call https://api.cloudflare.com/client/v4/accounts/:accountId/images/v1/moderation
 * 3. Map the response classification to safe/unsafe with confidence
 */
export async function scanImageForNsfw(
	_imageUrl: string,
): Promise<{ safe: boolean; confidence?: number }> {
	return { safe: true };
}
