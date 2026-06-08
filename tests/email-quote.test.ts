import assert from "node:assert/strict";
import test from "node:test";
import {
	stripQuotedMailHtml,
	stripQuotedMailPlainText,
} from "../shared/email-quote.ts";

test("stripQuotedMailHtml removes blockquote history", () => {
	const html =
		"<p>Hi team</p><blockquote>On Mon wrote:<br>old</blockquote>";
	assert.equal(stripQuotedMailHtml(html), "<p>Hi team</p>");
});

test("stripQuotedMailPlainText removes On ... wrote tail", () => {
	const text = "test\n\nOn Mon, Jun 8, 2026, 2:54 PM, admin@vsbg.vn wrote:\n\nold";
	assert.equal(stripQuotedMailPlainText(text), "test");
});

test("stripQuotedMailPlainText removes forwarded message blocks", () => {
	const text = "Please review\n\nForwarded message:\nFrom: a@b.com";
	assert.equal(stripQuotedMailPlainText(text), "Please review");
});