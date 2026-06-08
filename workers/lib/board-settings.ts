export function isNewTopicSend(input: {
	in_reply_to?: string | null;
	thread_id?: string | null;
}) {
	return !input.in_reply_to && !input.thread_id;
}

/** Board posting rules apply only to new threads aimed at public boards. */
export function shouldTreatAsBoardNewTopic(
	isNewThread: boolean,
	hasPublicBoardRecipient: boolean,
) {
	return isNewThread && hasPublicBoardRecipient;
}

export async function loadMailboxSettings(
	bucket: R2Bucket,
	mailboxId: string,
): Promise<Record<string, unknown>> {
	const normalized = mailboxId.trim().toLowerCase();
	const obj = await bucket.get(`mailboxes/${normalized}.json`);
	if (!obj) return {};
	return (await obj.json()) as Record<string, unknown>;
}

export function isPlatformAdmin(
	accessEmail: string,
	accessEmailAddresses: readonly string[],
): boolean {
	const normalized = accessEmail.trim().toLowerCase();
	if (!normalized) return false;
	const allowed = new Set(
		accessEmailAddresses.map((email) => email.trim().toLowerCase()).filter(Boolean),
	);
	return allowed.has(normalized);
}

export function getBoardMeta(settings: Record<string, unknown>) {
	return {
		isPublicBoard: settings.isPublicBoard === true,
		boardName:
			typeof settings.boardName === "string"
				? settings.boardName.trim()
				: "",
		boardDescription:
			typeof settings.boardDescription === "string"
				? settings.boardDescription.trim()
				: "",
	};
}