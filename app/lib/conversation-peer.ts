import { Folders } from "shared/folders";
import type { Email } from "~/types";

export interface ConversationPeer {
	email: string;
	name: string;
}

function firstAddress(value?: string | null): string {
	if (!value) return "";
	return value.split(",")[0]?.trim() || "";
}

export function getConversationPeer(
	email: Email,
	mailboxEmail: string | undefined,
	folder?: string,
): ConversationPeer {
	const self = mailboxEmail?.trim().toLowerCase() || "";
	const displayName = email.contact_display_name?.trim();

	if (folder === Folders.SENT || email.folder_id === Folders.SENT) {
		const peerEmail = firstAddress(email.recipient) || email.sender;
		return {
			email: peerEmail,
			name: displayName || peerEmail.split("@")[0] || peerEmail,
		};
	}

	const sender = email.sender.trim().toLowerCase();
	if (sender && sender !== self) {
		return {
			email: email.sender,
			name: displayName || email.sender.split("@")[0] || email.sender,
		};
	}

	const peerEmail = firstAddress(email.recipient) || email.sender;
	return {
		email: peerEmail,
		name: displayName || peerEmail.split("@")[0] || peerEmail,
	};
}