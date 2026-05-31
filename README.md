# Kerodex

Kerodex is a source-available private-party car marketplace prototype focused on fast search, premium vehicle browsing, trust systems, map-first discovery, and a path toward mobile apps and cloud-native microservices.

The product goal is simple: help real owners sell real cars directly to buyers with better vehicle data, safer identity workflows, and a cleaner experience than traditional classified marketplaces.

> Status: early local prototype. The current implementation is intentionally inexpensive to run and avoids paid cloud services until the product shape is proven.

## What Exists Today

- Premium responsive web marketplace UI.
- Dedicated search results experience with grid and map modes.
- Local Node.js API with realistic seed listings.
- Local authentication demo flow for email, Google, and Apple placeholders.
- Separate local admin dashboard app with protected admin API routes, role-based access, analytics, moderation queues, verification review, CSV exports, and immutable audit-log scaffolding.
- Leaflet/CARTO map browsing with grid/map search modes, clickable vehicle pins, and theme-aware map tiles.
- Removable beta/demo inventory notice for public launch preparation.
- Postgres-ready store adapter with local JSON seed fallback.
- Smoke test coverage for the local prototype.
- GitHub Actions CI workflow.
- Architecture direction for AWS, microservices, search, trust, AI, and real-time systems.

## Repository Structure

```text
apps/
  api/
    server.js        # Dependency-free local API/static server
    store.js         # JSON fallback or Postgres-backed listing store
    seed/            # Demo listing and conversation JSON
  admin/
    server.js        # Separate local admin frontend server
    public/          # Admin dashboard UI
  web/
    public/
      index.html     # Homepage
      search.html    # Search results page
      app.js         # Homepage client behavior
      search.js      # Search results behavior
      styles.css     # Current UI system
      assets/        # Logo assets
docs/
  architecture.md    # System architecture notes
  api.md             # API direction
  database.md        # Database schema direction
  roadmap.md         # MVP and scaling roadmap
scripts/
  seed-database.js   # Copies demo JSON into Postgres record tables
  smoke-test.js      # CI smoke test
.github/
  workflows/
    ci.yml           # GitHub Actions pipeline
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

Run tests:

```powershell
npm.cmd test
```

## Current Technical Approach

This prototype stays close to $0:

- Local development can run from JSON seed files without a database.
- Hosted environments can set `DATABASE_URL` to read listings/conversations from Postgres.
- No paid AWS infrastructure yet.
- No build step required.
- Local static assets and demo seed data.
- Leaflet with CARTO basemaps for free map rendering during beta.

This keeps iteration fast while the product, UX, and data model are still changing.

## Database Prep

The current beta database bridge uses two Postgres record tables:

- `listing_records`
- `conversation_records`

Run this after setting `DATABASE_URL`:

```powershell
npm.cmd install
npm.cmd run db:seed
```

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
- No real OAuth client IDs are required locally.
- Demo auth is intentionally local-only.

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
