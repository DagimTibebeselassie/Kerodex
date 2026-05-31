# Kerodex Web React App

This is the current Kerodex web experience. It is a React, Vite, TypeScript, and Tailwind app served by `apps/api/server.js` after running a production build.

## Main Screens

- Home page with search, curated listing rows, map preview, trust messaging, and Kerodex Assistant placeholder.
- Search page with grid/map modes, advanced filters, sorting, mobile filter sheet, Leaflet/CARTO map pins, and listing popup cards.
- Vehicle detail page with gallery, seller card, trust score, buyer risk meter, scam warnings, market value panel, payment estimator, trade-in UI, features, history, timeline, and maintenance record summary.
- Sell page with VIN autofill, dependent make/model fields, photo upload previews, listing fields, and backend listing creation.
- Seller cockpit with active/draft listing management, completeness scoring, analytics panels, and VIN decoder.
- Verification center with demo phone OTP, ID upload, selfie upload, trust points, and badge states.
- Messages, saved cars, account/profile, and auth modal flows.

## Local Commands

From the repository root:

```powershell
npm.cmd --prefix apps/web-react run lint:types
npm.cmd --prefix apps/web-react run build
npm.cmd test
```

Start the local API/static server:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:4100
```

## Backend Integration

The web app uses `src/lib/api.ts` for Kerodex API calls:

- `GET /api/listings`
- `GET /api/listings/:id`
- `POST /api/listings`
- `GET /api/conversations`
- `GET /api/vin/decode/:vin`
- demo auth endpoints under `/api/auth`

The current app still uses local/demo state for some beta behaviors, including saved cars, some message replies, verification status, and listing action mock states. These are intentionally shaped so they can later be replaced with real database-backed endpoints.

## Notes

- Maps use Leaflet with CARTO tiles.
- Map panes are isolated so Leaflet layers do not cover the sticky nav or assistant UI.
- The app supports dark/light mode through document-level theme classes.
- The build may show warnings from `@blinkdotnew/ui` internals and chunk size. They do not block the current build.
