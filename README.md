# Kerodex

Kerodex is a source-available private-party car marketplace prototype focused on fast search, premium vehicle browsing, trust systems, map-first discovery, and a path toward mobile apps and cloud-native microservices.

The product goal is simple: help real owners sell real cars directly to buyers with better vehicle data, safer identity workflows, and a cleaner experience than traditional classified marketplaces.

> Status: beta-stage marketplace app. The current implementation supports local development, Postgres-backed production storage, S3-backed uploads, and CI checks for backend and frontend changes.

## What Exists Today

- Premium responsive React/Vite marketplace UI.
- Dedicated search results experience with grid and map modes.
- Node.js API/static server with JSON fallback and Postgres-ready persistent storage.
- Local authentication flow with email verification plus Google and Microsoft OAuth hooks.
- Separate local admin dashboard app with protected admin API routes, role-based access, analytics, moderation queues, verification review, CSV exports, and immutable audit-log scaffolding.
- Leaflet/CARTO map browsing with grid/map search modes, clickable vehicle pins, and theme-aware map tiles.
- Removable beta/demo inventory notice for public launch preparation.
- Postgres-ready store adapter with local JSON seed fallback.
- S3-ready uploads through backend-generated presigned URLs for listings, verification photos, profile images, and documents.
- MarketCheck VIN and valuation enrichment with backend-side caching.
- Textract OCR hooks for title and maintenance document checks.
- Vehicle presence photo challenge workflow with manual review fallback.
- Optional Persona hosted identity verification hook for sellers.
- Smoke test coverage for the local prototype.
- GitHub Actions CI for API syntax, smoke tests, web build, repository health, dependency review, and CodeQL.
- Architecture direction for AWS, microservices, search, trust, AI, and real-time systems.

## Repository Structure

```text
apps/
  api/
    server.js        # Dependency-free local API/static server
    store.js         # JSON fallback or Postgres-backed marketplace store
    marketcheck.js   # MarketCheck VIN/valuation service
    textract.js      # AWS Textract OCR service
    vehicle-presence.js # Vehicle presence verification analysis
    seed/            # Demo seller, listing, and conversation JSON
  admin/
    server.js        # Separate local admin frontend server
    public/          # Admin dashboard UI
  web-react/
    src/             # React/Vite marketplace app
    public/          # Public icons and static assets
    dist/            # Production build output
docs/
  architecture.md    # System architecture notes
  api.md             # API direction
  database.md        # Database schema direction
  roadmap.md         # MVP and scaling roadmap
  security-hardening-report.md # Current hardening summary
scripts/
  seed-database.js   # Copies demo JSON into Postgres record tables
  smoke-test.js      # CI smoke test
.github/
  workflows/
    ci.yml           # API, smoke, web build, and repo health checks
    codeql.yml       # GitHub CodeQL security analysis
```

## Run Locally

PowerShell may block `npm.ps1` on this machine. Use `npm.cmd` if needed:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:4100
```

Run the separate admin app in another terminal:

```powershell
npm.cmd run dev:admin
```

Open:

```text
http://localhost:4101
```

The local demo admin login is:

```text
Email: admin@kerodex.local
Access code: kerodex-admin-local
```

Set `ADMIN_ACCESS_CODE` before starting the API to change the local admin access code.

Copy `.env.example` to `.env.local` for local secrets. The API loads `.env.local` automatically and the file is ignored by Git.

```powershell
Copy-Item .env.example .env.local
```

OAuth and email verification use these variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID
RESEND_API_KEY
AUTH_EMAIL_FROM
```

Persona uses:

```text
PERSONA_INQUIRY_TEMPLATE_ID
PERSONA_TEMPLATE_ID
PERSONA_API_KEY
```

Photo uploads use:

```text
AWS_REGION
S3_BUCKET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
```

The backend generates signed S3 `PUT` URLs and the browser uploads files directly to S3. The S3 bucket should stay private and needs CORS allowing browser `PUT` requests from your local and production domains. In production, set `S3_PUBLIC_BASE_URL` to a controlled delivery base such as CloudFront rather than making the whole bucket public. Upload keys are separated under `listings/`, `verification/`, `maintenance-records/`, `title-documents/`, and `profile-pictures/`, and records store both the final URL and S3 object key.

Optional document OCR checks use AWS Textract through the backend only:

```text
TEXTRACT_AWS_REGION
TEXTRACT_AWS_ACCESS_KEY_ID
TEXTRACT_AWS_SECRET_ACCESS_KEY
TEXTRACT_POLL_INTERVAL_MS
```

Textract can reuse the normal AWS credentials if the Textract-specific variables are blank. Seller-uploaded maintenance records and title documents are stored in S3 first, then OCR runs in the background and saves extracted text, matched keywords, document status, Textract job metadata, provider, and processed timestamp on the listing record. If Textract is unavailable, times out, or billing/permissions fail, the document is kept and marked for manual review without blocking listing creation. The buyer UI only shows safe soft signals such as "Title document uploaded" or "VIN on uploaded title matches listing"; it does not show full extracted title text, seller addresses, or claim that ownership/title authenticity is verified.

Vehicle presence verification uses a listing-specific code and an uploaded proof photo before a seller listing becomes public:

```text
OPENAI_API_KEY
VEHICLE_PRESENCE_MODEL
VEHICLE_PRESENCE_CODE_HOURS
```

The listing is saved immediately as `pending_verification`, then a backend background job uses OCR plus AI vision to check whether the proof photo shows the windshield VIN visible through the windshield and the exact listing-specific code held next to it. Verification only passes when the extracted VIN matches the listing VIN, the extracted code matches the generated code, and the image appears to be an original vehicle/VIN photo. If AI/OCR is not configured or confidence is low, the listing stays hidden and enters the admin verification queue. Public wording is limited to "Vehicle Presence Verified" and does not claim ownership, title validity, condition, authenticity, or legal guarantees.

Run tests:

```powershell
npm.cmd test
```

Run the full local CI-style check:

```powershell
npm.cmd run ci
```

Build the React marketplace:

```powershell
npm.cmd run build:web
```

## Current Technical Approach

This prototype stays close to $0:

- Local development can run from JSON seed files without a database.
- Hosted environments should set `DATABASE_URL` to read users, sellers, listings, conversations, and MarketCheck cache records from Postgres.
- Set `REQUIRE_DATABASE=true` in production so the API fails fast instead of falling back to local seed data.
- No paid AWS infrastructure yet.
- Web builds use Vite; the Node API serves the built frontend when `apps/web-react/dist` exists.
- Local static assets and demo seed data.
- Leaflet with CARTO basemaps for free map rendering during beta.

This keeps iteration fast while the product, UX, and data model are still changing.

## Database Prep

The current beta database bridge uses Postgres record tables:

- `user_records`
- `seller_records`
- `listing_records`
- `conversation_records`
- `marketcheck_cache`

Run this after setting `DATABASE_URL`:

```powershell
npm.cmd install
npm.cmd run db:seed
```

`npm.cmd run db:seed` clears and reloads the demo sellers, listings, and conversations so the local JSON seed and hosted database stay aligned. User accounts are created through the app and saved to `user_records` when `DATABASE_URL` is set.

The normalized long-term schema remains in `docs/database-schema.sql`.

## Target Architecture

Kerodex is designed to grow toward a distributed architecture:

- Web: Next.js or equivalent SSR frontend.
- Mobile: React Native or Flutter.
- API gateway: AWS API Gateway, Kong, or ALB.
- Core services: users, listings, search, vehicles, messaging, offers, payments, trust and safety, AI.
- Data: PostgreSQL, Redis, OpenSearch, S3, event streams.
- Real-time: WebSockets, server-sent events, push notifications.
- Events: Kafka/MSK or SQS/SNS depending on scale and cost.
- Cloud: AWS with a low-cost path first, then ECS/EKS when justified.

## Future Systems

Planned production-grade areas:

- Seller identity verification.
- Vehicle ownership verification.
- VIN decoding.
- Recall and title checks.
- Fraud scoring.
- AI listing descriptions.
- AI pricing guidance.
- AI duplicate listing detection.
- Image privacy processing, including plate blur and EXIF stripping.
- Secure messaging and offer negotiation.
- Payments for boosts/subscriptions.
- Admin moderation and audit tooling.

## CI/CD

The current GitHub Actions workflow runs:

- Checkout.
- Node.js setup.
- Smoke tests.

As the app grows, CI/CD should expand to:

- Unit tests.
- Integration tests.
- Accessibility checks.
- Security scans.
- Container builds.
- Preview deployments.
- Infrastructure validation.
- Staging deploys.
- Production deploy approvals.

## Security Posture

Current prototype:

- No production secrets should be committed.
- OAuth secrets must stay in `.env.local` locally or in the host environment in production.
- Email verification uses Resend when `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are set; otherwise local development displays a temporary code.

Production direction:

- JWT/session hardening.
- MFA support.
- Device/session tracking.
- Rate limiting.
- Upload scanning.
- Audit logging.
- Admin panel isolation at `admin.kerodexofficial.com`, backed by protected `/api/admin/*` routes rather than browser database access.
- Secrets manager.
- Least-privilege IAM.
- WAF and DDoS controls.

## Source Availability

This repository is intended to be visible for collaboration and review, but it is not currently licensed as open source. No license is granted to copy, redistribute, sublicense, or reuse the code unless explicit written permission is provided by the owner.

If Kerodex later becomes truly open source, add an approved open-source license and update this section.
