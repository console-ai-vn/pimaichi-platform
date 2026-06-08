import assert from "node:assert/strict";
import test from "node:test";
import { isPlatformAdmin } from "../workers/lib/board-settings.ts";

test("isPlatformAdmin matches ACCESS_EMAIL_ADDRESSES case-insensitively", () => {
	assert.equal(
		isPlatformAdmin("Admin@Example.com", ["admin@example.com"]),
		true,
	);
	assert.equal(
		isPlatformAdmin("member@example.com", ["admin@example.com"]),
		false,
	);
	assert.equal(isPlatformAdmin("", ["admin@example.com"]), false);
});