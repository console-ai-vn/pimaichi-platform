# ONYX Demo Security Follow-ups

## Live Demo
- URL: `https://onyx-email.ceo-23f.workers.dev`
- Custom domain: `https://box.onyx.com.vn`
- Worker: `onyx-email`
- R2 bucket: `onyx-email`
- Mailbox: `marketing@onyx.com.vn`
- Demo deploy version: `8ac6ebba-1888-479f-af93-103865613ba2`

## Fix Before Real Users
1. Rotate the Cloudflare credential exposed during setup.
2. Create a Cloudflare Access self-hosted app for the Worker URL.
3. Allow approved emails with One-time PIN.
4. Set `TEAM_DOMAIN` and `POLICY_AUD`.
5. Remove `DEMO_MODE=true` from `wrangler.jsonc`.
6. Configure `marketing@onyx.com.vn` Email Routing to Worker `onyx-email`.
7. Dependency audit completed: `npm audit` reports `0 vulnerabilities`.
8. Replace demo mailbox deletion feature gate with an archive/deactivation flow.

## Demo Verification
- Live root returns `200`.
- Live config returns domain `onyx.com.vn` and mailbox `marketing@onyx.com.vn`.
- Cross-mailbox request returns `403`.
- Wrong attachment URL returns `404`.
- Image send API returns `202`.
- Sent email record includes image attachment metadata.
- Private R2 attachment download returns `200 image/png`.
- Browser UI renders inbox, compose image controls, Sent row, and image attachment card.
