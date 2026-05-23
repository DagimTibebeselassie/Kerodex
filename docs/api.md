# API Design

The current prototype exposes a tiny local API. It is shaped so it can later become REST routes behind an API gateway.

## Current Routes

```http
GET /api/health
GET /api/listings
GET /api/listings/:id
GET /api/conversations
GET /api/events
```

## Listing Query Parameters

- `q` - keyword search across title, make, model, trim, body, fuel, and features.
- `make` - exact make filter.
- `bodyType` - body style filter.
- `fuelType` - fuel type filter.
- `maxPrice` - max listing price.
- `maxMileage` - max mileage.

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
