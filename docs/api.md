# API Design

The current prototype exposes a tiny local API. It is shaped so it can later become REST routes behind an API gateway.

Listings, sellers, and conversations now load through `apps/api/store.js`. Local development uses the seed JSON files, and hosted environments can set `DATABASE_URL` to read the same records from Postgres tables (`seller_records`, `listing_records`, and `conversation_records`).

Use `npm run seed:demo-listings` to upsert the deterministic 75-listing nationwide
demo marketplace. Use `npm run clear:demo-listings` to remove only demo
listings. Both commands preserve real listings. Demo records use `is_demo`,
`isDemo`, and a stable `demoSeedId` so rerunning the seed does not create
duplicates.

## Current Routes

```http
GET /api/health
GET /api/listings
GET /api/listings/:id
GET /api/sellers/:id
GET /api/conversations
POST /api/conversations
GET /api/events
GET /api/vin/decode/:vin
GET /api/auth/google
GET /api/auth/microsoft
GET /api/auth/callback/google
GET /api/auth/callback/microsoft
POST /api/auth/email
POST /api/auth/email/verify
POST /api/auth/password/forgot
POST /api/auth/password/reset
POST /api/buyer-guide/start
POST /api/buyer-guide/respond
POST /api/buyer-guide/recommendations
GET /api/buyer-guide/session/:id
PATCH /api/buyer-guide/session/:id
POST /api/buyer-guide/session/:id/listing/:listingId
POST /api/buyer-guides/start
GET /api/buyer-guides
GET /api/buyer-guides/:id
PATCH /api/buyer-guides/:id
```

The singular `/api/buyer-guide/*` routes power the full discovery journey and
allow temporary guest sessions. Logged-in sessions are persisted. The plural
`/api/buyer-guides/*` routes remain the listing-specific purchase checklist
surface for saved account guides.

`POST /api/buyer-guide/recommendations` returns a constrained structured object
containing a buyer profile, recommended categories and models, Kerodex listing
filters, safety notes, and scored listing matches. If the configured OpenAI
provider is unavailable or returns invalid output, the API returns deterministic
fallback recommendations rather than breaking the flow.

## Admin Routes

The admin dashboard is a separate frontend app and never connects directly to the database. It talks to protected admin-only API routes. Local development uses a demo access-code login; production should replace this with hardened auth, MFA, device checks, and optional IP allowlisting or Cloudflare Access.

```http
POST /api/admin/auth/login
GET /api/admin/session
GET /api/admin/dashboard
GET /api/admin/analytics
GET /api/admin/activity
GET /api/admin/search?q=
GET /api/admin/users
GET /api/admin/users/:id
PATCH /api/admin/users/:id/actions
GET /api/admin/listings
PATCH /api/admin/listings/:id/actions
GET /api/admin/verifications
PATCH /api/admin/verifications/:id/actions
GET /api/admin/reports
PATCH /api/admin/reports/:id/actions
GET /api/admin/fraud-flags
PATCH /api/admin/fraud-flags/:id/actions
GET /api/admin/audit-logs
GET /api/admin/system
GET /api/admin/notifications
GET /api/admin/feature-flags
GET /api/admin/tickets
GET /api/admin/export/:collection
GET /api/admin/events
```

`GET /api/admin/activity` combines stored `analytics_events` with immutable
`audit_records`. It supports `q`, `eventType`, `userId`, `listingId`, `source`,
`dateFrom`, `dateTo`, `page`, and `pageSize`.

Admin item responses for users, listings, and reports include related database
records such as listings, conversations, reports, activity, and admin actions.

Admin roles are scaffolded as `support_agent`, `verification_specialist`, `moderator`, `administrator`, and `super_admin`. Every admin mutation records an immutable audit entry with timestamp, admin account, action type, previous value, and new value.

Message-content access must remain gated behind a report, fraud investigation, or legal requirement. The current UI exposes that rule and the API audit-log foundation; production should enforce message-content access with a dedicated permission and investigation record.

## Listing Query Parameters

- `q` - keyword search across title, make, model, trim, body, fuel, and features.
- `make` - exact make filter.
- `bodyType` - body style filter.
- `fuelType` - fuel type filter.
- `maxPrice` - max listing price.
- `maxMileage` - max mileage.
- `minPrice` - minimum listing price.
- `minYear` / `maxYear` - year range filters.
- `minMileage` - minimum mileage.
- `drivetrain` - drivetrain filter.
- `cleanTitle` - when `1`, only listings with clean title signals.
- `noAccidents` - when `1`, only listings with no-accident signals.

## Current Map Behavior

- Search has grid and full-map modes.
- Map mode uses Leaflet with CARTO light/dark basemaps based on page theme.
- Vehicle pins open an image-first listing preview and link to the listing detail page.
- Browser geolocation, when allowed, sorts listings by distance and includes the user location in map bounds.
- Homepage map uses the same Leaflet/CARTO styling with a larger embedded canvas.

## Future REST Surface

```http
POST /auth/login
POST /auth/oauth/google
POST /auth/oauth/microsoft
GET /users/me
PATCH /users/me
POST /listings
GET /listings
GET /listings/:id
PATCH /listings/:id
POST /listings/:id/images
POST /listings/:id/favorite

Authenticated saved vehicles are persisted in `favorite_records`.

GET /me/saved

Returns only saved listings that still exist. Deleted listing references are
removed automatically by the database relationship.

POST /me/saved/sync

Migrates valid legacy browser-saved listing IDs into the authenticated
account. IDs for listings that no longer exist are ignored.

GET /me/listing-analytics

Returns database-backed analytics only for the signed-in seller's listings.

POST /listings/:id/status

Marks a seller-owned listing sold or available and stores voluntary sale
outcome details.

GET|POST /me/followups

Returns and records optional buyer purchase follow-ups after meaningful
conversation activity.

POST /conversations/:id/outcome

Stores the signed-in participant's lightweight conversation outcome.

POST /feedback

Stores optional contextual product feedback.

GET /admin/costs
GET /admin/feedback

Protected admin-only cost and feedback analytics.
POST /listings/:id/report
POST /offers
PATCH /offers/:id
GET /conversations
POST /conversations
GET /conversations/:id/messages
POST /conversations/:id/messages
GET /search/suggest
POST /vehicle-intelligence/vin-decode
```

## Future Event Names

- `listing.created`
- `listing.updated`
- `listing.viewed`
- `listing.price_changed`
- `message.sent`
- `offer.created`
- `offer.countered`
- `fraud.detected`
- `verification.completed`
