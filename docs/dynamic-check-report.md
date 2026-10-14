# Dynamic functionality check — 14 October 2026

Admin: http://localhost:3000 · API: http://localhost:4000/api/docs

## Steps and results

1. **Compilation:** backend build and admin TypeScript check passed.
2. **Screens and read APIs:** 187 browser/API checks across super admin, support, maintenance, and agency owner. Covered all primary office/agency sections and representative record-detail pages. Final pass had no browser JavaScript exceptions or API 500 responses. Expected 403 responses were observed for restricted roles. Support and maintenance invoice screens displayed the expected access-denied message.
3. **Interactive browser checks:** sign-in, draft filter, empty search results, country selector, enquiries with empty filters, header search navigation, logout, and corrupted-session recovery passed.
4. **API workflows:** 35 assertions passed for authentication, access restrictions, cross-agency isolation, filters, pagination, empty search, country code/name matching, all four CSV exports, upload and file retrieval, invalid input, draft creation, persisted edits, photo scoring, publication rejection, and session revocation.
5. **Cleanup:** temporary property, photo/event records, its moderation/audit entries, and uploaded test file were removed. Login metadata, revoked test sessions, and export audit entries are normal consequences of these checks.

## Fixes

- Preserved directory filters in the shared query DTO. The global validation whitelist had silently removed status, publication, agency, and other filters.
- Accepted the UI's empty unassigned filter while validating explicit true/false values.
- Resolved country codes to names for property filters and applied country filtering to enquiries.
- Returned HTTP 400 when an upload request has no file, instead of dereferencing an absent file.
- Recovered from malformed or structurally invalid local session data by clearing it and showing sign-in.

## Re-run workflow checks

With PostgreSQL and the backend running, using the seeded demo accounts:

```sh
cd backend
node scripts/check-dynamic.cjs
```

This script creates and removes a temporary property and upload. It also creates normal session/export audit records. Browser/API sweep evidence is in `dynamic-check-results.json`.

## Coverage limits

This is a local development functional check, not exhaustive verification of every mutation or a security audit. Payments, invoice adjustments, announcement sending, account deletion, password resets, invitation acceptance, permission changes, and live publication were not executed. Reel upload screens loaded; actual video processing was not tested. Mobile layout, production build/deployment, external email/payment services, and concurrent-user behavior were not tested. Some UI copy remains demo-specific (for example, invitation identity/expiry and agency country labels).
