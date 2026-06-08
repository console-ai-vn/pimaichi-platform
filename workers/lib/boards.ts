import { getLegacyAccessOptions } from "./mailbox";
import {
	normalizeRecipientField,
	getRecipientRouting,
} from "./recipient-routing";
import {
	listMailboxes,
	getMailboxStub,
} from "./email-helpers";
import { roleHasPermission } from "./permissions";
import {
	getBoardMeta,
	isNewTopicSend,
	loadMailboxSettings,
} from "./board-settings";
import { resolveBoardAccessRole } from "./board-access";
import type { Env } from "../types";

export {
	getBoardMeta,
	isNewTopicSend,
	loadMailboxSettings,
} from "./board-settings";

export async function resolveBoardNewTopicPosting(
	env: Env,
	recipients: {
		to: string | string[];
		cc?: string | string[];
		bcc?: string | string[];
	},
	replyMeta: {
		in_reply_to?: string | null;
		thread_id?: string | null;
	},
): Promise<boolean> {
	if (!isNewTopicSend(replyMeta)) return false;
	const routing = getRecipientRouting(env, recipients);
	for (const address of routing.internalRecipients) {
		const settings = await loadMailboxSettings(env.BUCKET, address);
		if (getBoardMeta(settings).isPublicBoard) return true;
	}
	return false;
}

export class BoardAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BoardAccessError";
	}
}

export interface AccessibleBoard {
	id: string;
	email: string;
	boardName: string;
	boardDescription?: string;
	canPost: boolean;
	avatarUpdatedAt?: string;
	coverUpdatedAt?: string;
}

export async function listAccessibleBoards(
	env: Env,
	accessEmail: string,
): Promise<AccessibleBoard[]> {
	const accessOptions = await getLegacyAccessOptions(env);
	const boards: AccessibleBoard[] = [];

	for (const mailbox of await listMailboxes(env.BUCKET)) {
		const settings = await loadMailboxSettings(env.BUCKET, mailbox.id);
		const meta = getBoardMeta(settings);
		if (!meta.isPublicBoard) continue;

		const stub = getMailboxStub(env, mailbox.id);
		const role = await resolveBoardAccessRole(
			env,
			accessEmail,
			mailbox.id,
			accessOptions,
			(email) => stub.getExplicitMailboxRole(email),
			settings,
		);
		if (!role || !roleHasPermission(role, "read")) continue;

		boards.push({
			id: mailbox.id,
			email: mailbox.email,
			boardName: meta.boardName || mailbox.email.split("@")[0] || mailbox.email,
			boardDescription: meta.boardDescription || undefined,
			canPost: roleHasPermission(role, "send"),
			avatarUpdatedAt:
				typeof settings.avatarUpdatedAt === "string"
					? settings.avatarUpdatedAt
					: undefined,
			coverUpdatedAt:
				typeof settings.coverUpdatedAt === "string"
					? settings.coverUpdatedAt
					: undefined,
		});
	}

	return boards.sort((a, b) => a.boardName.localeCompare(b.boardName));
}

export async function assertOutboundRecipientsAllowed(
	env: Env,
	accessEmail: string,
	recipients: {
		to: string | string[];
		cc?: string | string[];
		bcc?: string | string[];
	},
	options: { isNewTopic: boolean },
) {
	const routing = getRecipientRouting(env, recipients);
	const accessOptions = await getLegacyAccessOptions(env);

	if (options.isNewTopic) {
		const toRecipients = normalizeRecipientField(recipients.to);
		if (toRecipients.length === 0) {
			throw new BoardAccessError("Choose a board to post to.");
		}
		if (
			normalizeRecipientField(recipients.cc).length > 0 ||
			normalizeRecipientField(recipients.bcc).length > 0
		) {
			throw new BoardAccessError("New topics cannot include CC or BCC.");
		}
	}

	for (const address of routing.internalRecipients) {
		const settings = await loadMailboxSettings(env.BUCKET, address);
		const { isPublicBoard } = getBoardMeta(settings);

		if (options.isNewTopic && !isPublicBoard) {
			throw new BoardAccessError(
				`New topics can only be posted to admin boards. "${address}" is not a board.`,
			);
		}

		if (!isPublicBoard) continue;

		const stub = getMailboxStub(env, address);
		const role = await resolveBoardAccessRole(
			env,
			accessEmail,
			address,
			accessOptions,
			(email) => stub.getExplicitMailboxRole(email),
			settings,
		);
		if (!role || !roleHasPermission(role, "send")) {
			throw new BoardAccessError(
				`You do not have permission to post to ${address}`,
			);
		}
	}
}