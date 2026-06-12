# Kerodex Security Hardening Report

Date: 2026-06-12

## Improvements Added

- Added route-aware API rate limiting:
  - General API routes: 100 requests per IP per 15 minutes.
  - Authentication routes: 10 requests per IP per 15 minutes.
  - Upload and verification routes: 20 requests per IP per hour.
- Added clean JSON rate-limit responses and server-side violation logs.
- Added Helmet-style security headers directly to the custom Node HTTP server:
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `Strict-Transport-Security` in production
- Replaced permissive wildcard CORS with an allow-list:
  - `https://kerodexofficial.com`
  - `https://www.kerodexofficial.com`
  - localhost and 127.0.0.1 development URLs
- Added request body size limits for API JSON/text requests.
- Added production response cleanup so `detail` and `stack` fields are not returned to browsers in production.
- Strengthened token and verification-code generation with `crypto` instead of `Math.random`.
- Added stronger password requirements for new, reset, and changed passwords.
- Added PBKDF2 password hashing for new/updated passwords.
- Preserved compatibility with existing legacy password records and upgrades them after successful login.
- Added repeated failed login logging.
- Added server-side logout token invalidation.
- Added S3 upload validation improvements:
  - Blocks GIFs and executable-style extensions.
  - Allows only JPEG, PNG, WebP, and PDF where appropriate.
  - Validates MIME type and extension match before issuing signed upload URLs.
  - Keeps existing size limits for profile, listing, verification, title, and maintenance uploads.
- Added server-side guardrails for listings:
  - VIN format enforcement.
  - Realistic year, price, and mileage checks.
  - Trimmed/capped listing text fields.
- Added server-side trimming/length limits for reports and messages.
- Hardened OAuth callback errors so provider/internal details are logged server-side but not exposed to users.
- Added startup environment warnings for missing important production configuration.
- Confirmed `.env` and `.env.local` are ignored by git.

## Files Modified

- `apps/api/server.js`
- `apps/api/store.js`
- `apps/web-react/src/lib/api.ts`
- `docs/security-hardening-report.md`

## Remaining Risks

- Rate limiting is currently in memory. This is fine for a single EC2 process, but if Kerodex runs multiple API instances later, use Redis, a managed gateway, or load-balancer/WAF rate limits.
- Admin accounts are still configured in code as local role records. Production should move admin users and permissions into the database with MFA.
- Some older routes still include `detail` in development responses for debugging. Production strips those fields before sending the response.
- CAPTCHA is not implemented yet. The backend now has rate-limit and suspicious-login logging, but CAPTCHA should be added later for signup, login, password reset, and high-risk message/report flows.
- Existing legacy plaintext passwords are only upgraded after users successfully log in or reset/change their password. No existing account data was force-changed.
- File validation checks declared MIME type and extension before S3 signing. Deep content scanning or antivirus scanning would require a later service.
- CORS is browser protection. It does not replace authentication or server-side authorization.

## Recommended Next Steps

- Put Cloudflare, AWS WAF, or an ALB/API Gateway in front of the EC2 app for edge rate limits and bot filtering.
- Add Redis-backed rate limiting before scaling beyond one API instance.
- Add MFA for admin accounts.
- Move admin account definitions to Postgres.
- Add CAPTCHA hooks after suspicious signup/login/password-reset behavior.
- Add virus scanning for uploaded documents and images.
- Add a recurring dependency audit command to deployment.

## Performance And UX Impact

- Normal users should not notice the new limits.
- Heavy refreshing, repeated login failures, or upload spam may now receive `429` responses.
- Very large JSON payloads are rejected before they can consume backend memory.
- Users creating new email/password accounts must use stronger passwords.
- Existing users can still sign in with their current passwords; the password is upgraded after a successful login.
