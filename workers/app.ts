// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { routeAgentRequest } from "agents";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { EmailMCP } from "./mcp";
import { getAccessEmail, normalizeEmail } from "./lib/access";
import type { AccessVariables, Env } from "./types";

export { MailboxDO } from "./durableObject";
export { OrgFeedDO } from "./durableObject/orgFeed";
export { EmailAgent } from "./agent";
export { EmailMCP } from "./mcp";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);
const mcpHandler = EmailMCP.serve("/mcp", { binding: "EMAIL_MCP" });

function getAccessUrls(teamDomain: string) {
	const certsPath = "/cdn-cgi/access/certs";
	const teamUrl = new URL(
		teamDomain.startsWith("http://") || teamDomain.startsWith("https://")
			? teamDomain
			: `https://${teamDomain}`,
	);
	const issuer = teamUrl.origin;
	const certsUrl = teamUrl.pathname.endsWith(certsPath)
		? teamUrl
		: new URL(certsPath, issuer);

	return { issuer, certsUrl };
}

// Main app that wraps the API and adds React Router fallback
const app = new Hono<{ Bindings: Env; Variables: AccessVariables }>();

const PUBLIC_HOSTNAMES = new Set(["start.vsbg.vn"]);
const PUBLIC_ASSET_PATHS = new Set([
	"/favicon.ico",
	"/favicon.svg",
	"/robots.txt",
]);

function isPublicRequest(req: Request) {
	const url = new URL(req.url);
	if (!PUBLIC_HOSTNAMES.has(url.hostname)) return false;
	if (url.pathname === "/" || url.pathname === "/signup") return true;
	if (PUBLIC_ASSET_PATHS.has(url.pathname)) return true;
	if (url.pathname.startsWith("/assets/")) return true;
	return url.pathname === "/api/public/signup-requests" && req.method === "POST";
}

const CSP_POLICY =
	"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
	"img-src 'self' data: blob: https:; connect-src 'self'; frame-src 'none'; object-src 'none'";

// Cloudflare Access JWT validation middleware (production only)
app.use("*", async (c, next) => {
	if (isPublicRequest(c.req.raw)) {
		c.set("accessEmail", "");
		return next();
	}

	if (!import.meta.env.DEV && c.env.DEMO_MODE === "true") {
		return c.text("DEMO_MODE must not be enabled in production", 500);
	}

	// Skip validation in development
	if (import.meta.env.DEV) {
		c.set("accessEmail", normalizeEmail(c.req.header("x-dev-user-email") || ""));
		return next();
	}
	if (c.env.DEMO_MODE === "true") {
		const [demoMailbox = ""] = (c.env.EMAIL_ADDRESSES ?? []) as string[];
		c.set("accessEmail", normalizeEmail(demoMailbox));
		return next();
	}

	const { POLICY_AUD, TEAM_DOMAIN } = c.env;

	// Fail closed in production if Access is not configured.
	if (!POLICY_AUD || !TEAM_DOMAIN) {
		return c.text(
			"Cloudflare Access must be configured in production. Set POLICY_AUD and TEAM_DOMAIN.",
			500,
		);
	}

	const token = c.req.header("cf-access-jwt-assertion");
	if (!token) {
		return c.text("Missing required CF Access JWT", 403);
	}

	try {
		const { issuer, certsUrl } = getAccessUrls(TEAM_DOMAIN);
		const JWKS = createRemoteJWKSet(certsUrl);
		const { payload } = await jwtVerify(token, JWKS, {
			issuer,
			audience: POLICY_AUD,
		});
		c.set("accessEmail", getAccessEmail(payload));
	} catch {
		return c.text("Invalid or expired Access token", 403);
	}
	return next();
});

app.use("*", async (c, next) => {
	await next();
	if (isPublicRequest(c.req.raw)) return;
	c.res.headers.set("Content-Security-Policy", CSP_POLICY);
});

// MCP server endpoint — used by AI coding tools (ProtoAgent, Claude Code, Cursor, etc.)
// Must be before API routes and React Router catch-all
app.all("/mcp", (c) => mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/*", (c) => mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));

// Mount the API routes
app.route("/", apiApp);

// Agent WebSocket routing - must be before React Router catch-all
app.all("/agents/*", async (c) => {
	return (
		(await routeAgentRequest(c.req.raw, c.env)) ??
		c.text("Agent not found", 404)
	);
});

// React Router catch-all: serves the SPA for all non-API routes
app.all("*", (c) => {
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
	});
});

// Export the Hono app as the default export with an email handler
export default {
	fetch: app.fetch,
	async email(
		event: { raw: ReadableStream; rawSize: number },
		env: Env,
		ctx: ExecutionContext,
	) {
		try {
			await receiveEmail(event, env, ctx);
		} catch (e) {
			console.error("Failed to process incoming email:", (e as Error).message, (e as Error).stack);
			// Re-throw so Cloudflare's email routing can retry delivery or bounce the message.
			// Swallowing the error would silently drop the email.
			throw e;
		}
	},
};
