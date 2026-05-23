# Kerodex

Kerodex is a source-available private-party car marketplace prototype focused on fast search, premium vehicle browsing, trust systems, map-first discovery, and a path toward mobile apps and cloud-native microservices.

The product goal is simple: help real owners sell real cars directly to buyers with better vehicle data, safer identity workflows, and a cleaner experience than traditional classified marketplaces.

> Status: early local prototype. The current implementation is intentionally inexpensive to run and avoids paid cloud services until the product shape is proven.

## What Exists Today

- Premium responsive web marketplace UI.
- Dedicated search results experience with grid and map modes.
- Local Node.js API with realistic seed listings.
- Local authentication demo flow for email, Google, and Apple placeholders.
- Leaflet/OpenStreetMap map browsing.
- Smoke test coverage for the local prototype.
- GitHub Actions CI workflow.
- Architecture direction for AWS, microservices, search, trust, AI, and real-time systems.

## Repository Structure

```text
apps/
  api/
    data.js          # Seed listings and demo data
    server.js        # Dependency-free local API/static server
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

Run tests:

```powershell
npm.cmd test
```

## Current Technical Approach

This prototype stays close to $0:

- No database dependency yet.
- No paid AWS infrastructure yet.
- No build step required.
- No package install required for the running app.
- Local static assets and seed data.
- OpenStreetMap tiles via Leaflet for development.

This keeps iteration fast while the product, UX, and data model are still changing.

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
- Secrets manager.
- Least-privilege IAM.
- WAF and DDoS controls.

## Source Availability

This repository is intended to be visible for collaboration and review, but it is not currently licensed as open source. No license is granted to copy, redistribute, sublicense, or reuse the code unless explicit written permission is provided by the owner.

If Kerodex later becomes truly open source, add an approved open-source license and update this section.
