const ALLOWED_FEED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_FEED_IMAGE_BYTES = 4 * 1024 * 1024;

export function feedTopicImageKey(topicId: string, imageId: string) {
	return `feed/topics/${topicId.trim().toLowerCase()}/${imageId}`;
}

export function feedCommentImageKey(commentId: string, imageId: string) {
	return `feed/comments/${commentId}/${imageId}`;
}

export function decodeFeedImageUpload(input: { content: string; type: string }) {
	const type = input.type.trim().toLowerCase();
	if (!ALLOWED_FEED_IMAGE_TYPES.has(type)) {
		throw new Error("Image must be JPEG, PNG, or WebP");
	}

	const binary = atob(input.content);
	if (binary.length > MAX_FEED_IMAGE_BYTES) {
		throw new Error("Image must be 4MB or smaller");
	}

	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return { bytes, contentType: type };
}