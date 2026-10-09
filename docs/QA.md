# Verification report — 2026-10-09

## Passed

- TypeScript type check (`tsc --noEmit`).
- Production Worker/client build.
- 24 integration tests against the compiled application in an isolated Miniflare Workers runtime with actual D1 SQL migrations, private R2 and image-decoding WASM:
  1. Catalog seeding.
  2. Administrative authorization and cross-origin mutation rejection.
  3. One-time admin bootstrap and password authentication.
  4. Draft creation and server-side price authority.
  5. Cross-customer order authorization.
  6. Blocking generation and final uploads before verified payment.
  7. Invalid image rejection, WebP decoding, private reference access.
  8. Required consents and included-style validation.
  9. Server price/currency and original customer text preservation.
  10. Failed, cancelled, successful, duplicate and concurrent mock callbacks; one payment and one fulfillment event.
  11. Disconnected AI escalates, never invents output.
  12. Manual final uploads, exact output count, quality review before delivery.
  13. Private individual downloads and valid ZIP.
  14. Expiring HMAC file links and tamper rejection.
  15. One-time customer access links, replay and expiry rejection.
  16. Revision limit and manual resolution.
  17. Email remains explicitly disconnected; no false sent status.
  18. Actual scheduled-handler execution deletes expired R2 objects and metadata; access blocked before cleanup.
  19. Refund request/approval sequence and duplicate refund rejection.
  20. Publishing requires complete, human-reviewed translations.
  21. All three dictionaries have matching nonempty keys and statuses.
  22. Server-rendered Arabic RTL, English LTR and Georgian LTR.
  23. JPEG/PNG decoding, EXIF removal and explicit photo deletion.
  24. Automatic deletion of unpaid uploads after 24 hours.

## Source review

- Locally hosted Noto Arabic/Georgian fonts. Responsive grids, RTL logical properties, LTR technical identifiers.
- Keyboard-focus outlines, semantic forms/labels, skip link, live error/status regions, reduced-motion preference.
- File upload processing is sequential; large camera originals are downscaled before upload. Server independently checks byte length, format, dimensions and full decoding.
- No card storage, public portrait bucket, customer analytics payloads, fake testimonials, discounts, scarcity or video offers.
- Bank and AI connections fail closed. Delivery-result approval requires verified payment and real administrator uploads.

## Not verified / production gates

- Browser interaction, real phone upload/HEIC behavior, visual screenshots, 200% zoom and slow-network UX could not be tested here because the approved browser-preview path was unavailable. Responsive/accessibility support is implemented and source-reviewed, not certified.
- No live banking, international card, Apple Pay, live AI or email-delivery test was possible without approved accounts and credentials.
- Scheduled-handler logic is tested. Real hosted cron activation and a production execution log still require confirmation; deployment alone does not prove the timer is running.
- Arabic is complete draft copy, not native-reviewed. Legal documents are editable drafts, not legally approved policies.
- No formal penetration test or regulatory certification has been performed.
