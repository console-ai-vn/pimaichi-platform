import assert from "node:assert/strict";
import test from "node:test";
import {
	buildListAppendBody,
	resolveAccessOtpAutomation,
} from "../workers/lib/cloudflare-zero-trust-list.ts";

test("resolveAccessOtpAutomation returns null when token missing", () => {
	const result = resolveAccessOtpAutomation(
		{ CF_ACCOUNT_ID: "acc", ACCESS_OTP_LIST_ID: "list" } as never,
		{ domains: [], emailAddresses: [], accessEmailAddresses: [] },
	);
	assert.equal(result, null);
});

test("resolveAccessOtpAutomation requires CF_API_EMAIL for global API key", () => {
	const result = resolveAccessOtpAutomation(
		{
			CF_ACCOUNT_ID: "acc",
			ACCESS_OTP_LIST_ID: "list",
			CF_API_TOKEN: "cfk_example",
		} as never,
		{ domains: [], emailAddresses: [], accessEmailAddresses: [] },
	);
	assert.equal(result, null);
});

test("resolveAccessOtpAutomation prefers domain config over env", () => {
	const result = resolveAccessOtpAutomation(
		{
			CF_ACCOUNT_ID: "env-acc",
			ACCESS_OTP_LIST_ID: "env-list",
			CF_API_TOKEN: "token",
		} as never,
		{
			domains: [],
			emailAddresses: [],
			accessEmailAddresses: [],
			cfAccountId: "cfg-acc",
			accessOtpListId: "cfg-list",
		},
	);
	assert.deepEqual(result, {
		accountId: "cfg-acc",
		listId: "cfg-list",
		apiToken: "token",
	});
});

test("buildListAppendBody normalizes email", () => {
	const body = buildListAppendBody("USER@Gmail.com", "VSBG signup");
	assert.deepEqual(body, {
		append: [{ value: "user@gmail.com", description: "VSBG signup" }],
	});
});