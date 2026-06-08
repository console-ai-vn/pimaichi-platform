// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	index,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	index("routes/landing.tsx"),
	route("signup", "routes/signup.tsx"),
	route("home", "routes/home-redirect.tsx"),
	route("home/topics/:topicId", "routes/home-topic-redirect.tsx"),
	route("app", "routes/home.tsx"),
	route("mailbox/:mailboxId", "routes/mailbox.tsx", [
		index("routes/mailbox-index.tsx"),
		route("feed", "routes/mailbox-feed-layout.tsx", [
			index("routes/home-feed.tsx"),
			route("topics/:topicId", "routes/home-topic.tsx"),
		]),
		route("emails/:folder", "routes/email-list.tsx"),
		route("settings", "routes/settings.tsx"),
		route("audit", "routes/audit.tsx"),
		route("admin/domains", "routes/admin-domains.tsx"),
		route("search", "routes/search-results.tsx"),
	]),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
