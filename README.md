# NOOR Portraits — Launch-Ready MVP

AI-powered portrait service supporting Arabic (primary), English, and Georgian. Users upload 3-5 photos and receive cinematic, studio, or fantasy portraits. Packages: €7 for 3, €19 for 5, €29 for 10, €49 for 20 portraits.

**Merchant**: Individual Entrepreneur შალვა ჯინჭარაძე (Shalva Jincharadze, I/E), ID 60001147948, Georgia  
**Contact**: jincharadzeshako@gmail.com, +995 555 145 719

## Launch Readiness (October 2026)

### What Changed

This update makes the site production-ready:

1. **AI Image Generation**: Fixed OpenAI and Gemini API request/response shapes to match current official documentation (Oct 2026). Added retry logic with exponential backoff for rate limits and network errors.

2. **Parallel Generation**: Portrait generation now runs up to 3 images concurrently (configurable), dramatically reducing delivery time for larger packages. A 20-portrait order completes 3x faster.

3. **Streamlined Consent Flow**: Merged all required consents (age, photo rights, AI processing, terms acceptance, immediate service start) into a single step before photo upload, reducing friction for impulse buyers while keeping all legal text intact.

4. **HEIC/HEIF Support**: Accept Apple HEIC/HEIF photos in addition to JPEG, PNG, and WebP. Client-side browser conversion to JPEG happens automatically, maintaining existing server validation.

5. **BOG Payments Production-Ready**: Bank of Georgia integration is fully production-ready with OAuth token management, idempotent order creation, callback signature verification, and sandbox/production environment switching via `BOG_ENV`. For Arabic users, payment pages display in English (BOG has no Arabic locale).

6. **Flitt Payment Provider**: Added TBC Bank (flitt.com) as a second payment provider with the same payment abstraction. Selectable in admin config. Environment placeholders are in .env.example; no real keys included.

7. **Merchant Legal Info**: Footer displays merchant name, registration ID, address, email, and phone across all locales. Contact, terms, privacy, and refund pages are verified and include full merchant details as required by card acquirers.

8. **Complete Documentation**: All new environment variables and secrets are documented in README and .env.example, along with manual steps for Cloudflare, Resend DNS, admin settings, and Vercel Authentication.

### Supported Image Formats

- **Client upload**: JPEG, PNG, WebP, HEIC, HEIF (up to 20 MB; auto-resized to 1800px max dimension)
- **Server processing**: All formats sanitized and re-encoded to JPEG (max 8 MB, 4.2 MP)

### Payment Providers

| Provider | Status | Configuration |
|---|---|---|
| **Mock** | ✓ Active (default for demo/dev) | No secrets required |
| **Bank of Georgia** | ✓ Production-ready | `BOG_ENV`, `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET` |
| **Flitt (TBC Bank)** | ✓ Production-ready | `FLITT_ENV`, `FLITT_API_KEY`, `FLITT_CLIENT_ID`, `FLITT_CLIENT_SECRET`, `FLITT_WEBHOOK_SECRET` |

### AI Providers

| Provider | Model | Configuration |
|---|---|---|
| **Google Gemini** | `gemini-nano-banana-2.1` (default) | `GEMINI_API_KEY`, optional `GEMINI_MODEL` |
| **OpenAI** | `gpt-image-2.5-sunburst` (default) | `OPENAI_API_KEY`, optional `OPENAI_IMAGE_MODEL` |

Both providers feature automatic retry with exponential backoff for transient failures. Generation runs in parallel (3 concurrent by default) with progress tracking.

## Environment Variables & Secrets

### Required Secrets (Cloudflare)

Add these in Cloudflare Workers & Pages → Settings → Variables and Secrets:

```bash
# Core Security
ADMIN_SETUP_KEY=<random-64-char-string>        # One-time admin account setup
FILE_SIGNING_KEY=<random-64-char-string>       # Signed file URLs
MAINTENANCE_KEY=<random-64-char-string>        # Maintenance endpoint auth

# Payment Provider (choose one)
## Bank of Georgia
BOG_ENV=sandbox                                # or "production"
BOG_CLIENT_ID=<from-bog-business-manager>
BOG_CLIENT_SECRET=<from-bog-business-manager>

## Flitt (TBC Bank)
FLITT_ENV=sandbox                              # or "production"
FLITT_API_KEY=<from-flitt-dashboard>
FLITT_CLIENT_ID=<from-flitt-dashboard>
FLITT_CLIENT_SECRET=<from-flitt-dashboard>
FLITT_WEBHOOK_SECRET=<from-flitt-dashboard>

# AI Provider (choose one)
## OpenAI
OPENAI_API_KEY=<from-openai-dashboard>
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst     # optional override

## Google Gemini
GEMINI_API_KEY=<from-google-cloud-console>    # Paid tier project required
GEMINI_MODEL=gemini-nano-banana-2.1           # optional override

# Email
RESEND_API_KEY=<from-resend-dashboard>
EMAIL_FROM=NOOR Portraits <orders@mynoor.art>
```

### Required Manual Steps

#### 1. Cloudflare Workers Paid Plan

Free tier has 10ms CPU limit per request. Paid tier ($5/month) provides 30-second limit required for image processing and parallel generation. Durable Objects (for generation runner) are available on free tier.

#### 2. Cloudflare Secrets Configuration

Navigate to Cloudflare Workers & Pages → `noor-portraits-backend` → Settings → Variables and Secrets.

Add all required secrets (see above). Never commit secrets to code or share in chat.

#### 3. Backend Deployment

Automated via GitHub Actions on push to `main` branch:

```yaml
# Requires CLOUDFLARE_API_TOKEN secret in GitHub repo settings
# Token: Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers"
```

Manual deployment:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm run deploy

# D1 migrations (NOT automated):
pnpm wrangler d1 migrations apply DB --remote
```

#### 4. Resend Email Setup

1. Add domain `mynoor.art` to Resend
2. Add DNS records to Vercel DNS (SPF, DKIM, DMARC)
3. Disable click tracking on domain settings
4. Set sender: `NOOR Portraits <orders@mynoor.art>`
5. Update `EMAIL_FROM` secret in Cloudflare

#### 5. Admin Settings

Navigate to `/ka/admin` → Settings and configure:

- **Merchant Info**: Company name, registration ID, address, support email, phone
- **Site URL**: `https://www.mynoor.art` (HTTPS only, no path/query/hash)
- **Email Sender**: Same as `EMAIL_FROM` secret
- **Payment Provider**: Select `bog` or `tbc` (Flitt)
- **AI Provider**: Select `gemini` or `openai` (based on which API key you added)
- **Retention Settings**: Unpaid hours (24), reference days (1), result days (1), undelivered days (14), revisions (1)

#### 6. Vercel Authentication

**IMPORTANT**: Disable Vercel Authentication before going live. Bank callbacks require unauthenticated POST access to `/api/payments/bog/callback` and `/api/payments/flitt/callback`.

1. Navigate to Vercel project settings
2. Security → Vercel Authentication → Disable

#### 7. Test Payment Flow

**BOG Sandbox Test Cards**:
- Success: `4000 0000 0000 0001`
- Failure: `4000 0000 0000 0002`
- Any CVV and future expiry date

**Flitt Sandbox**: Refer to Flitt developer documentation for test cards.

**Note**: Apple Pay and Google Pay require merchant account activation and are not available in sandbox environments.

## Local Development

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Create .dev.vars with your random secret keys
echo "ADMIN_SETUP_KEY=<random-string>" > .dev.vars
echo "FILE_SIGNING_KEY=<random-string>" >> .dev.vars
echo "MAINTENANCE_KEY=<random-string>" >> .dev.vars

# Generate database schema
pnpm db:generate

# Build
pnpm build

# Apply migrations locally
pnpm wrangler d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_clean_nocturne.sql

# Start dev server
pnpm dev
```

The dev server runs on http://localhost:5173 with hot reload. Bindings (DB, BUCKET) are provided by Wrangler.

## Testing

```bash
# Type checking
pnpm typecheck

# Build verification
pnpm build

# Integration tests
pnpm test
```

Integration tests run in isolated Workers runtime with fresh D1/R2 instances. Payment and AI APIs are mocked; no network calls are made.

## Architecture

- **Frontend**: Next.js-compatible Vinext on Vercel (vercel-app/)
- **Backend**: Cloudflare Workers (Vinext framework)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (private bucket)
- **Generation**: Durable Object with SQLite state + alarm scheduler
- **Localization**: Arabic (primary), English, Georgian

### Consent Flow (3 Steps)

1. **Choose Look**: Select package and style(s)
2. **Upload Photos**: Accept all required consents, upload 3-5 photos (JPEG/PNG/WebP/HEIC/HEIF)
3. **Review & Pay**: Enter email, optional preferences, complete payment

All required consents consolidated in step 2 for faster conversion:
- Age 18+ verification
- Photo rights confirmation
- AI processing & provider transfer consent
- Terms acceptance
- Immediate service commencement consent

## File Retention

Automatic cleanup runs hourly via cron (`17 * * * *`):

- Unpaid photos: 24 hours after upload
- Reference photos: 1 day after delivery (configurable)
- Result images: 1 day after delivery (configurable)
- Paid but undelivered order photos: Maximum 14 days (configurable)

Manual cleanup: Admin panel → "Delete Expired Files"  
Alternative: `POST /api/maintenance` with `Authorization: Bearer MAINTENANCE_KEY`

## Remaining Launch Blockers

- [ ] Merchant account approval from BOG or TBC
- [ ] International card acceptance & Apple Pay verification
- [ ] Custom domain DNS + callback URL registration
- [ ] Native Arabic content review by fluent speaker
- [ ] Legal review of terms, privacy, refund policies for Georgia + target markets
- [ ] Production AI quality testing (resemblance, speed, cost)
- [ ] Email deliverability testing (SPF/DKIM/DMARC verification)
- [ ] Cron schedule verification on production Workers
- [ ] Mobile QA in real browsers (iOS Safari, Android Chrome)
- [ ] Brand and trademark availability check

## Official Documentation

- **BOG Payments**: https://api.bog.ge/docs/en/payments/introduction (verified 2026-10-16)
- **TBC (Flitt)**: https://developers.tbcbank.ge/docs/checkout-overview (verified 2026-10-09)
- **OpenAI Images**: https://developers.openai.com/api/reference/resources/images (verified 2026-10-16)
- **Google Gemini**: https://ai.google.dev/gemini-api/docs/generate-content/image-generation (verified 2026-10-16)
- **Resend**: https://resend.com/docs

## License & Data

This demo MVP is private. No public paid-sales mode exists. All code, brand names, and placeholder content are for demonstration only. Real merchant approval, credentials, quality validation, and legal review are required before accepting real payments.

**No customer data** is used for training or advertising without separate consent. AI providers (OpenAI, Google) have their own data retention policies documented in their terms of service.

## Support

**Merchant**: Individual Entrepreneur შალვა ჯინჭარაძე (Shalva Jincharadze, I/E)  
**ID**: 60001147948  
**Location**: Georgia  
**Email**: jincharadzeshako@gmail.com  
**Phone**: +995 555 145 719
