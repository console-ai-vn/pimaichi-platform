// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface Env extends Cloudflare.Env {
	POLICY_AUD?: string;
	TEAM_DOMAIN?: string;
	ACCESS_EMAIL_ADDRESSES: Cloudflare.Env["ACCESS_EMAIL_ADDRESSES"];
	DEMO_MODE?: string;
	CF_ACCOUNT_ID?: string;
	CF_API_TOKEN?: string;
	CF_API_EMAIL?: string;
	ACCESS_OTP_LIST_ID?: string;
	PAYOS_CLIENT_ID?: string;
	PAYOS_API_KEY?: string;
	PAYOS_CHECKSUM_KEY?: string;
	PAYMENT: DurableObjectNamespace;
	INVENTORY: DurableObjectNamespace;
	LIVE: DurableObjectNamespace;
	CF_STREAM_TOKEN?: string;
	CF_STREAM_SIGNING_KEY?: string;
	CF_IMAGES_TOKEN?: string;
	CF_IMAGES_ACCOUNT_HASH?: string;
	REFRESH_SECRET?: string;
	ACCESS_SECRET?: string;
	TURNSTILE_SECRET_KEY?: string;
	TURNSTILE_SITE_KEY?: string;
}

export interface AccessVariables {
	accessEmail: string;
}
