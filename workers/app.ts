// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { routeAgentRequest } from "agents";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { app as mediaApp } from "./routes/media";
import { app as liveApp } from "./routes/live";
import { app as gateApp } from "./routes/gate";
import { app as creatorApp } from "./routes/creator";
import { z } from "zod";
import { applySecurityHeaders, applyCspHeaders } from "./lib/security-headers";
import { generateRefreshToken, verifyRefreshToken, generateAccessToken } from "./lib/token-refresh";
import { checkRateLimit } from "./lib/rate-limiter";
import { scanImageForNsfw } from "./lib/nsfw-stub";
import { EmailMCP } from "./mcp";
import { getAccessEmail, normalizeEmail } from "./lib/access";
import {
	parseAgentMailboxId,
	resolveToolMailboxRole,
	withToolAccessEmail,
} from "./lib/tool-authz";
import { roleHasPermission } from "./lib/permissions";
import type { AccessVariables, Env } from "./types";

export { MailboxDO } from "./durableObject";
export { OrgFeedDO } from "./durableObject/orgFeed";
export { PaymentDO } from "./durableObject/payment";
export { InventoryDO } from "./durableObject/inventory";
export { LiveDO } from "./durableObject/live";
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
const mcpHandler = EmailMCP.serve("/mcp", {
	binding: "EMAIL_MCP",
	corsOptions: import.meta.env.DEV
		? {
				origin: "http://localhost:5173",
				methods: "GET, POST, DELETE, OPTIONS",
			}
		: {
				origin: "https://box.onyx.com.vn",
				methods: "GET, POST, DELETE, OPTIONS",
			},
});

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

const PUBLIC_HOSTNAMES = new Set(["start.onyx.com.vn"]);
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
	if (url.pathname.startsWith("/api/v1/creator/")) return true;
	return (
		url.pathname === "/api/public/signup-requests" && req.method === "POST"
	);
}

// Cloudflare Access JWT validation middleware (production only)
app.use("*", async (c, next) => {
	if (isPublicRequest(c.req.raw)) {
		c.set("accessEmail", "");
		return next();
	}

	if (!import.meta.env.DEV && c.env.DEMO_MODE === "true") {
		return c.text("DEMO_MODE must not be enabled in production", 500);
	}

	if (import.meta.env.DEV) {
		c.set(
			"accessEmail",
			normalizeEmail(c.req.header("x-dev-user-email") || ""),
		);
		return next();
	}
	if (c.env.DEMO_MODE === "true") {
		const [demoMailbox = ""] = (c.env.EMAIL_ADDRESSES ?? []) as string[];
		c.set("accessEmail", normalizeEmail(demoMailbox));
		return next();
	}

	const { POLICY_AUD, TEAM_DOMAIN } = c.env;

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

// Phase 07: Security headers + CSP middleware
app.use("*", async (c, next) => {
	await next();
	if (isPublicRequest(c.req.raw)) return;
	c.res = applySecurityHeaders(c.res);
	c.res = applyCspHeaders(c.res);
});

function forwardMcpRequest(c: {
	req: { raw: Request };
	var: AccessVariables;
	env: Env;
	executionCtx: { waitUntil: (promise: Promise<unknown>) => void };
}) {
	const accessEmail = c.var.accessEmail;
	const request = withToolAccessEmail(c.req.raw, accessEmail);
	const ctx = Object.assign(c.executionCtx, {
		props: { accessEmail },
	});
	return mcpHandler.fetch(request, c.env, ctx as ExecutionContext);
}

// MCP server endpoint — used by AI coding tools (ProtoAgent, Claude Code, Cursor, etc.)
// Must be before API routes and React Router catch-all
app.all("/mcp", (c) => forwardMcpRequest(c));
app.all("/mcp/*", (c) => forwardMcpRequest(c));

// Mount the API routes
app.route("/", apiApp);

// Mount media pipeline routes (Cloudflare Stream & Images)
app.route("/", mediaApp);

// Mount live streaming routes (WebSocket + Stream Live)
app.route("/", liveApp);

// Mount content gate routes (PPV, signed URLs)
app.route("/", gateApp);

// Phase 08: Public creator profile routes (no auth required)
app.route("/", creatorApp);

// Agent WebSocket routing - must be before React Router catch-all
app.all("/agents/*", async (c) => {
	const mailboxId = parseAgentMailboxId(new URL(c.req.url).pathname);
	if (mailboxId) {
		const role = await resolveToolMailboxRole(
			c.env,
			c.var.accessEmail,
			mailboxId,
		);
		if (!role || !roleHasPermission(role, "read")) {
			return c.text("Forbidden", 403);
		}
	}

	const request = withToolAccessEmail(c.req.raw, c.var.accessEmail);
	return (
		(await routeAgentRequest(request, c.env)) ?? c.text("Agent not found", 404)
	);
});

// Phase 07: Auth token endpoints
const RefreshBody = z.object({ refreshToken: z.string().min(1) });

app.post("/api/v1/auth/refresh", async (c) => {
	let body: z.infer<typeof RefreshBody>
	try { body = RefreshBody.parse(await c.req.json()) } catch {
		return c.json({ error: "Invalid request body" }, 400)
	}
	const secret = c.env.REFRESH_SECRET
	if (!secret) return c.json({ error: "Refresh secret not configured" }, 500)
	const result = await verifyRefreshToken(body.refreshToken, secret)
	if (!result) return c.json({ error: "Invalid or expired refresh token" }, 401)
	const accessSecret = c.env.ACCESS_SECRET || secret
	const accessToken = await generateAccessToken(result.email, accessSecret)
	const refreshToken = await generateRefreshToken(result.email, secret)
	return c.json({ accessToken, refreshToken })
});

app.post("/api/v1/auth/access-token", async (c) => {
	let body: z.infer<typeof RefreshBody>
	try { body = RefreshBody.parse(await c.req.json()) } catch {
		return c.json({ error: "Invalid request body" }, 400)
	}
	const secret = c.env.REFRESH_SECRET
	if (!secret) return c.json({ error: "Refresh secret not configured" }, 500)
	const result = await verifyRefreshToken(body.refreshToken, secret)
	if (!result) return c.json({ error: "Invalid or expired refresh token" }, 401)
	const accessSecret = c.env.ACCESS_SECRET || secret
	const accessToken = await generateAccessToken(result.email, accessSecret)
	return c.json({ accessToken })
});

// Phase 07: Rate limiting for sensitive endpoints
app.use("/api/public/signup-requests", async (c, next) => {
	if (c.req.method !== "POST") return next()
	const ip = c.req.header("cf-connecting-ip") || "unknown"
	const result = checkRateLimit(`signup:${ip}`, 5, 60000)
	if (!result.allowed) return c.json({ error: "Too many signup requests" }, 429)
	return next()
});

app.use("/api/v1/payments/checkout", async (c, next) => {
	if (c.req.method !== "POST") return next()
	const ip = c.req.header("cf-connecting-ip") || "unknown"
	const result = checkRateLimit(`checkout:${ip}`, 10, 60000)
	if (!result.allowed) return c.json({ error: "Too many checkout attempts" }, 429)
	return next()
});

// Phase 07: NSFW image scan stub
app.post("/api/v1/security/scan-image", async (c) => {
	let body: { imageUrl?: string }
	try { body = await c.req.json() as { imageUrl?: string } } catch {
		return c.json({ error: "Invalid JSON body" }, 400)
	}
	if (!body.imageUrl) return c.json({ error: "imageUrl required" }, 400)
	const result = await scanImageForNsfw(body.imageUrl)
	return c.json(result)
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
			console.error(
				"Failed to process incoming email:",
				(e as Error).message,
				(e as Error).stack,
			);
			// Re-throw so Cloudflare's email routing can retry delivery or bounce the message.
			// Swallowing the error would silently drop the email.
			throw e;
		}
	},
};
