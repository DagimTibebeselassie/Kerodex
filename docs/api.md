# API Design

The current prototype exposes a tiny local API. It is shaped so it can later become REST routes behind an API gateway.

Listings and conversations now load through `apps/api/store.js`. Local development uses the seed JSON files, and hosted environments can set `DATABASE_URL` to read the same records from Postgres tables (`listing_records` and `conversation_records`). Run `npm run db:seed` after creating the database tables to copy the current demo inventory into Postgres.

## Current Routes

```http
GET /api/health
GET /api/listings
GET /api/listings/:id
GET /api/conversations
GET /api/events
GET /api/vin/decode/:vin
```

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
POST /auth/oauth/apple
GET /users/me
PATCH /users/me
POST /listings
GET /listings
GET /listings/:id
PATCH /listings/:id
POST /listings/:id/images
POST /listings/:id/favorite
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
