/** Strip HTML quote blocks (blockquote, forwarded wrappers). */
export function stripQuotedMailHtml(html: string): string {
	if (!html) return "";
	let result = html;
	for (let pass = 0; pass < 5; pass += 1) {
		const next = result.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "");
		if (next === result) break;
		result = next;
	}
	result = result.replace(
		/<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*?<\/div>/gi,
		"",
	);
	result = result.replace(
		/<div[^>]*>\s*<strong>\s*Forwarded message:\s*<\/strong>[\s\S]*?<\/div>/gi,
		"",
	);
	return result.trim();
}

/** Strip plain-text quote headers and quoted lines. */
export function stripQuotedMailPlainText(text: string): string {
	if (!text) return "";

	let trimmed = text.trim();
	const onWrote = trimmed.search(/\bOn .+ wrote:/i);
	if (onWrote >= 0) {
		trimmed = trimmed.slice(0, onWrote).trim();
	}

	const forwarded = trimmed.search(/\bForwarded message:/i);
	if (forwarded >= 0) {
		trimmed = trimmed.slice(0, forwarded).trim();
	}

	const lines = trimmed.split(/\r?\n/);
	const kept: string[] = [];
	for (const line of lines) {
		if (line.trim().startsWith(">")) break;
		kept.push(line);
	}

	return kept.join("\n").replace(/\s+/g, " ").trim();
}