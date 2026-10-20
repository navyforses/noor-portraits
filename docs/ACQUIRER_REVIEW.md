# Acquirer website review changes

Source repository: navyforses/noor-portraits. Snapshot based on main, observed commit `a33f88988f3ff074154c51521d2cd19e16380c0c` on 2026-10-20.

## Changes

- Updated English, Arabic and Georgian customer policies in both the root frontend and the independently deployed `vercel-app` frontend.
- Added merchant identity, identification number, address, email and telephone defaults. Empty and whitespace admin fields fall back to these values; populated settings remain usable.
- Published Terms, Refund and Privacy copy, plus Payment, Transaction Security and Legal Compliance policies through the existing locale catch-all route. The three new URLs are `/{locale}/payment-policy`, `/{locale}/security-policy` and `/{locale}/compliance-policy` for `ar`, `en` and `ka`.
- Added all policy links and complete merchant details to the footer. Contact includes complaints and removal requests.
- Added linked Terms, Refund and Payment policy consent in the photo-consent step and final checkout; retry checkout also requests consent.
- Added locally served official Visa, Mastercard, Apple Pay and Google Pay SVGs in the footer and payment UI, with qualified availability wording, Georgia and EUR disclosures. Sources are in PAYMENT_ASSETS.md.
- Kept final compliance strings from being overwritten by stale admin-published draft copy. Other content remains editable as before.
- Removed contradictory provisional-price, missing-merchant and launch-review copy. Preserved truthful test-payment labels when mock mode is actually configured. Initial settings loading no longer falsely labels the site as demo; create/checkout wait for the settings response.
- Corrected checkout hook ordering when the catalog switches from loading/demo to live mode.
- Did not add optional buyer name/phone fields, change schemas, change acquiring integrations, change AI generation or change retention behavior. Package prices and portrait counts are unchanged.

## Retention evidence

Policy values interpolate current catalog settings, rather than promising hard-coded periods. `lib/core.ts` implements:

- Unpaid or refunded: created_at + unpaidHours (default 24 hours).
- Verified and delivered: delivered_at + referenceDays/resultDays (both default 1 day).
- Verified but undelivered: created_at + undeliveredDays (default 14 days); zero disables this expiry.

`lib/server/retention.ts` deletes active bucket objects and file records; customer deletion does not erase order/payment/consent/audit records. File delivery routes deny expired access. `wrangler.jsonc` and `build/noor-worker.ts` configure hourly cleanup alongside the generation heartbeat. Analytics cleanup uses 30 days. No hard-coded external AI-provider retention promise remains.

## Verification

From `vercel-app`:

```sh
node node_modules/typescript/bin/tsc --noEmit
node --test tests/gateway.test.mjs tests/compliance.test.cjs
node node_modules/next/dist/bin/next build --webpack
```

TypeScript passed. The 10 existing gateway tests and 8 new compliance tests passed. The compliance tests render all six policies and contact in all three locales, check links/merchant defaults/RTL/checkout marks, and exercise the retention branches. Production compilation and build completed successfully after an initial local Windows EPERM directory-creation error was resolved. No real card charge or AI-generation request was made.

## Review blocker outside this patch

A read-only request to `https://www.mynoor.art/api/catalog` redirected to a Vercel login/SSO page. Public reachability and live retention/payment settings could not be verified. Ensure the production site and catalog are accessible to an unauthenticated bank reviewer; do not disable protection on admin-only surfaces. Merchant acquiring configuration, 3-D Secure behavior and actual wallet availability still need to be verified with BOG/Flitt on the production account. The copy describes hosted acquiring, not a claim that NOOR itself is PCI-certified.

The changes have not been pushed or deployed. Acquirer approval is not guaranteed by a code change.
