# Roadmap

## Phase 0: Local Foundation

- Node API/static server.
- React/Vite web app with premium responsive UI.
- Seed listings and demo conversations.
- Grid/map search with Leaflet/CARTO.
- Listing details, listing creation, saved cars, messages, verification, and seller cockpit UI.
- VIN decode bridge through the backend.
- Initial schema, API, architecture, and product docs.

## Phase 1: Real MVP

- Production auth with email/OAuth.
- Postgres database.
- Database-backed listing CRUD.
- S3 image upload pipeline with EXIF stripping and optional plate blur.
- Saved listings persisted to user accounts.
- Real message send/store endpoints.
- Seller cockpit backed by real listing/message/save data.
- Geo radius filtering and closest-first sorting.
- Location autofill/geocoding for listing creation.

## Phase 2: Marketplace Trust

- Phone verification provider.
- Email verification hardening.
- Identity verification provider evaluation.
- Ownership document review workflow.
- Vehicle photo challenge with generated Kerodex code.
- Listing trust score backed by real verification events.
- Maintenance record vault.
- Offers and counter-offers.
- Fraud reports.
- Moderation queue.
- Vehicle history and recall integrations.
- Market value provider or internal pricing model.

## Phase 3: Search Power

- Postgres full-text/trigram search.
- Geo radius filtering.
- Saved search alerts.
- Personalized ranking.
- OpenSearch only when traffic demands it.

## Phase 4: Mobile

- Expo/React Native app.
- Map-first browse.
- Camera listing flow.
- Push notifications.
- Biometric session unlock.
- Deep links for listings and messages.

## Phase 5: Monetization

- Stripe listing boosts.
- Premium seller tools.
- Financing and insurance referral integrations.
- Subscription analytics.

## Phase 6: Scale

- Service extraction.
- Redis cache.
- Background workers.
- Event bus.
- CDN media delivery.
- Kubernetes only when team size and traffic justify the overhead.
