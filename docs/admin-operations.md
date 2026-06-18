# Kerodex Admin Operations

The React admin control center is available at `/admin`. It uses protected
`/api/admin/*` routes and never connects directly to Postgres from the browser.

## Metric Sources

- User totals and account statuses: `user_records.payload`
- New and recently active users: user account and last-activity timestamps
- Listing totals, statuses, quality gaps, makes, models, and locations:
  `listing_records.payload`
- Conversations and messages: `conversation_records.payload`
- Verification queue, results, and confidence: `verification_records` plus
  vehicle-presence fields stored on listing records
- Reports, categories, targets, and resolution states: `report_records`
- Page views, searches, saves, listing views, signups, logins, messages, and
  platform activity: `analytics_events`
- Admin logins and moderation actions: immutable `audit_records`

Historical charts only show stored timestamps and events. Kerodex does not
generate fake historical values for dates before tracking began.

## Operational Sections

- Dashboard: current platform, marketplace, verification, messaging, and safety
  counts
- Activity: combined user/platform/system/admin event timeline with filtering
- Users: account status, listings, conversations, reports, activity, and notes
- Listings: vehicle data, seller data, status, reports, conversations, and
  moderation history
- Verifications: persisted verification review queue
- Reports: persisted safety reports and resolution actions
- Analytics: event-backed daily charts and database-backed breakdowns
- Admin Logs: immutable moderation and access records

## Database Changes

The existing tables are used:

- `analytics_events`
- `audit_records`
- `verification_records`
- `report_records`
- `user_records`
- `listing_records`
- `conversation_records`

Additional indexes:

- `idx_analytics_events_user_created`
- `idx_analytics_events_listing_created`

## Manual Test Checklist

1. Create an account and confirm total/new-user metrics change.
2. Update a profile and confirm `profile_updated` appears under Activity.
3. Verify a phone and confirm `phone_verified` appears under Activity.
4. Create a listing and confirm listing totals and activity change.
5. Open a listing and confirm listing-view tracking appears.
6. Approve, reject, remove, and restore a test listing; verify status and admin
   log entries.
7. Submit a vehicle verification and confirm it enters Verifications.
8. Approve or reject verification and confirm the listing status changes.
9. Start a conversation and send a message; confirm messaging counts change.
10. Submit a report and confirm it appears in Reports and Activity.
11. Mark the report reviewing, resolved, or dismissed and confirm audit history.
12. Ban a test user and confirm their active sessions are revoked.
13. Unban the user and confirm the database status returns to active.
14. Request `/api/admin/dashboard` without an admin token and confirm HTTP 401.

## Current Limitations

- Session duration and bounce-rate analytics require more detailed session-end
  tracking, so those values are not invented.
- Seller response-time and completed-sale metrics remain limited to records the
  marketplace currently stores.
- Existing historical activity starts when event tracking was introduced; the
  system does not backfill events that never occurred in the database.
