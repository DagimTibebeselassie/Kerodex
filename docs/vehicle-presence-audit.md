# Vehicle Presence Verification Audit

Last updated: 2026-06-14

## Purpose

Vehicle presence verification is designed to prove recent physical access to the listed vehicle. The seller must upload a photo showing both:

- The vehicle VIN visible through the windshield.
- The listing-specific verification code written or printed on paper next to that VIN.

This flow does not claim ownership verification, title verification, or authenticity guarantees.

## Environment Variables

The OpenAI analyzer reads:

- `OPENAI_API_KEY`
- `VEHICLE_PRESENCE_OPENAI_API_KEY` as a fallback or separate feature-specific key
- `VEHICLE_PRESENCE_MODEL`, defaulting to `gpt-4o-mini`

The model value is passed directly as the `model` field in the OpenAI Responses API request.

S3 signed upload and signed read URLs use:

- `AWS_REGION`
- `S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

## Execution Path

1. Frontend seller flow requests a verification code.
   - `apps/web-react/src/pages/Sell.tsx`
   - `apps/web-react/src/pages/VehicleDetail.tsx`
   - Backend route: `POST /api/vehicle-presence/code`
   - Backend file: `apps/api/server.js`

2. Seller uploads the verification image.
   - Backend route: `POST /api/uploads/presign`
   - Upload purpose: `vehicle-presence`
   - S3 key prefix: `verification/`
   - Backend file: `apps/api/server.js`

3. Seller creates or updates listing with the verification token, code, photo URL, and S3 key.
   - Create route: `POST /api/listings`
   - Update route: `PATCH /api/listings/:id`
   - Existing listing verification route: `POST /api/listings/:id/vehicle-presence`
   - Backend file: `apps/api/server.js`

4. Backend queues background verification.
   - Function: `scheduleVehiclePresenceVerification`
   - Backend file: `apps/api/server.js`

5. Background job marks the listing in progress.
   - Function: `processVehiclePresenceNow`

6. Backend generates a temporary S3 signed GET URL for the verification image.
   - Function: `createS3PresignedGet`
   - Backend file: `apps/api/server.js`

7. Backend sends the signed image URL to OpenAI.
   - Service: `apps/api/vehicle-presence.js`
   - Function: `analyzeWithOpenAi`
   - Endpoint: `https://api.openai.com/v1/responses`
   - Content includes both `input_text` and `input_image`.

8. OpenAI response is parsed and interpreted.
   - Checks used:
     - `vehicleVisible`
     - `vinPlateVisible`
     - `textVisible`
     - `codeMatches`
     - `vinMatches`
     - `likelyNewPhoto`
     - `confidence`
   - The listing is only verified when the expected VIN matches, the code matches, the VIN plate/vehicle are visible, the photo appears current, and confidence is at least `0.65`.

9. Backend saves the result to the listing.
   - Verified listings become `active`.
   - Failed or uncertain listings remain `pending_verification`.
   - Manual review requests are created for low-confidence or mismatch cases.

## Files Involved

- `apps/api/server.js`
  - S3 upload signing.
  - Presence code generation and consumption.
  - Listing create/update routes.
  - Background verification scheduling and result persistence.

- `apps/api/vehicle-presence.js`
  - OpenAI configuration.
  - OpenAI Responses API request.
  - JSON parsing.
  - Verification status decision mapping.

- `apps/api/store.js`
  - Persists listings and verification status.
  - Admin review updates can mark vehicle presence verification approved or rejected.

- `apps/web-react/src/pages/Sell.tsx`
  - Seller listing flow and vehicle presence upload UI.

- `apps/web-react/src/pages/VehicleDetail.tsx`
  - Existing listing re-verification flow and buyer-facing status display.

- `apps/web-react/src/lib/api.ts`
  - Frontend API methods for uploads, listing creation, and vehicle presence submission.

- `scripts/test-vehicle-presence.js`
  - Local test runner that calls the real vehicle presence analyzer against a sample image URL or local file.

## Logging Added

Server-side logs now show:

- OpenAI client initialized and which key source is used.
- Model being used.
- Whether the request includes an image.
- Image URL summary without printing the signed query string.
- OpenAI request started.
- OpenAI request succeeded.
- OpenAI error details including billing, quota, auth, and model errors.
- Interpreted verification checks and final status.
- Background job start/completion.

The API key is never logged.

## Manual Test Script

Run with a signed/public image URL:

```bash
npm run test:vehicle-presence -- --image-url "https://example.com/photo.jpg" --vin "1HGCM82633A004352" --code "KDX-4821" --year 2023 --make Toyota --model Corolla
```

Run with a local image:

```bash
npm run test:vehicle-presence -- --image-file "C:\path\to\verification-photo.jpg" --vin "1HGCM82633A004352" --code "KDX-4821"
```

The script reads `.env`, `.env.local`, `apps/api/.env`, and `apps/api/.env.local` if present.

## Audit Findings

- `OPENAI_API_KEY` is read, with `VEHICLE_PRESENCE_OPENAI_API_KEY` as fallback.
- `VEHICLE_PRESENCE_MODEL` is read, with `gpt-4o-mini` as fallback.
- The selected model is passed into the OpenAI API request body.
- The OpenAI request includes an `input_image` URL/data URL and the expected VIN/code in text instructions.
- The OpenAI response is used to determine vehicle visibility, VIN visibility, text/code visibility, VIN match, code match, screenshot/real-photo likelihood, and confidence.
- If OpenAI is missing or fails, the listing is not auto-approved. It falls back to manual review.

## Remaining Things To Verify In Production

- Confirm the PM2 process has the OpenAI environment variables after `pm2 restart kerodex-api --update-env`.
- Confirm S3 signed GET URLs are reachable from OpenAI before expiration.
- Confirm OpenAI account billing/quota supports the configured model.
- Test with a real windshield VIN/code photo because blurry VIN plates will correctly fail or require manual review.
