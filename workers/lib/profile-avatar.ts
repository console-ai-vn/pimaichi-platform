import { assertImageMagicBytes } from "./image-bytes.ts";

const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 4 * 1024 * 1024;

export function profileAvatarKey(mailboxId: string) {
	return `profiles/${mailboxId.trim().toLowerCase()}/avatar`;
}

export function profileCoverKey(mailboxId: string) {
	return `profiles/${mailboxId.trim().toLowerCase()}/cover`;
}

function decodeProfileImageUpload(
	input: { content: string; type: string },
	maxBytes: number,
	label: string,
) {
	const type = input.type.trim().toLowerCase();
	if (!ALLOWED_PROFILE_IMAGE_TYPES.has(type)) {
		throw new Error(`${label} must be JPEG, PNG, or WebP`);
	}

	const binary = atob(input.content);
	if (binary.length > maxBytes) {
		const maxMb = Math.round(maxBytes / (1024 * 1024));
		throw new Error(`${label} must be ${maxMb}MB or smaller`);
	}

	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	assertImageMagicBytes(bytes, type);
	return { bytes, contentType: type };
}

export function decodeAvatarUpload(input: {
	content: string;
	type: string;
}) {
	return decodeProfileImageUpload(input, MAX_AVATAR_BYTES, "Avatar");
}

export function decodeCoverUpload(input: {
	content: string;
	type: string;
}) {
	return decodeProfileImageUpload(input, MAX_COVER_BYTES, "Cover");
}

export function extractMailboxEmailFromSender(sender: string) {
	const match = sender.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	return match?.[0]?.toLowerCase() ?? null;
}