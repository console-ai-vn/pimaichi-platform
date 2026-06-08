import assert from "node:assert/strict";
import test from "node:test";
import {
	getBoardMeta,
	isNewTopicSend,
	shouldTreatAsBoardNewTopic,
} from "../workers/lib/board-settings.ts";

test("isNewTopicSend treats missing reply metadata as a new topic", () => {
	assert.equal(isNewTopicSend({}), true);
	assert.equal(isNewTopicSend({ in_reply_to: "msg-1" }), false);
	assert.equal(isNewTopicSend({ thread_id: "thread-1" }), false);
});

test("shouldTreatAsBoardNewTopic only applies board rules to new threads on boards", () => {
	assert.equal(shouldTreatAsBoardNewTopic(true, true), true);
	assert.equal(shouldTreatAsBoardNewTopic(true, false), false);
	assert.equal(shouldTreatAsBoardNewTopic(false, true), false);
});

test("getBoardMeta reads public board fields from mailbox settings", () => {
	const meta = getBoardMeta({
		isPublicBoard: true,
		boardName: " Sales ",
		boardDescription: "Deal room",
	});
	assert.equal(meta.isPublicBoard, true);
	assert.equal(meta.boardName, "Sales");
	assert.equal(meta.boardDescription, "Deal room");
});

test("getBoardMeta defaults non-board mailboxes to false", () => {
	const meta = getBoardMeta({ fromName: "Hieu" });
	assert.equal(meta.isPublicBoard, false);
});