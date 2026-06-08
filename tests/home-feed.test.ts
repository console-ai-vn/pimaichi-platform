import assert from "node:assert/strict";
import test from "node:test";
import {
	decodeFeedImageUpload,
	MAX_FEED_IMAGE_BYTES,
} from "../workers/lib/feed-images.ts";
import { htmlToPlainText } from "../workers/lib/feed-text.ts";

function sanitizeFeedHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.trim();
}

function isOrgMember(
	accessEmail: string,
	config: { emailAddresses: string[]; accessEmailAddresses: string[] },
): boolean {
	const normalized = accessEmail.trim().toLowerCase();
	const team = new Set(
		[...config.emailAddresses, ...config.accessEmailAddresses].map((email) =>
			email.trim().toLowerCase(),
		),
	);
	return team.has(normalized);
}

test("isOrgMember accepts configured team and admin emails", () => {
	const config = {
		emailAddresses: ["admin@vsbg.vn", "test@vsbg.vn"],
		accessEmailAddresses: ["ceo@bdsmetro.com"],
	};
	assert.equal(isOrgMember("admin@vsbg.vn", config), true);
	assert.equal(isOrgMember("ceo@bdsmetro.com", config), true);
	assert.equal(isOrgMember("outsider@vsbg.vn", config), false);
});

test("sanitizeFeedHtml strips script tags and inline handlers", () => {
	const sanitized = sanitizeFeedHtml(
		'<p onclick="alert(1)">Hi</p><script>alert(1)</script>',
	);
	assert.equal(sanitized.includes("<script"), false);
	assert.equal(sanitized.includes("onclick"), false);
	assert.match(sanitized, /Hi/);
});

test("htmlToPlainText converts basic markup to text", () => {
	assert.equal(htmlToPlainText("<p>Hello<br>world</p>"), "Hello world");
});

test("decodeFeedImageUpload rejects unsupported image types", () => {
	assert.throws(
		() => decodeFeedImageUpload({ content: "aGk=", type: "image/svg+xml" }),
		/JPEG, PNG, or WebP/i,
	);
});

test("decodeFeedImageUpload rejects oversized payloads", () => {
	const big = btoa("x".repeat(MAX_FEED_IMAGE_BYTES + 1));
	assert.throws(
		() => decodeFeedImageUpload({ content: big, type: "image/png" }),
		/4MB/i,
	);
});

test("org feed migrations include home feed tables", async () => {
	const { orgFeedMigrations } = await import(
		"../workers/durableObject/orgFeedMigrations.ts"
	);
	const migration = orgFeedMigrations.find(
		(entry) => entry.name === "16_add_home_feed",
	);
	assert.ok(migration);
	assert.match(migration?.sql ?? "", /topic_reactions/i);
});