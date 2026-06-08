export function isNewTopicSend(input: {
	in_reply_to?: string | null;
	thread_id?: string | null;
}) {
	return !input.in_reply_to && !input.thread_id;
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