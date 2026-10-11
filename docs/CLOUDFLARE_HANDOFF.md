# NOOR Portraits Cloudflare handoff

Updated: 2026-10-11. Migration is staged for Claude's PR review. The owner explicitly requested no Vercel/backend cutover before that review. Do not report the cutover as complete.

The owner declined GitHub CLI `workflow` scope. This branch was rebuilt from current `github/main`; no new PR commit changes `.github/workflows/`. Proposed backend CI is an inactive plain file at `docs/ci/cloudflare-backend.proposed.yml`, for the owner to review and install manually. Existing frontend CI is unchanged.

## Resources

| Resource | Name / ID / address |
| --- | --- |
| Cloudflare account | `414a50c18fa76da1f07ea9d3b62af7bc` |
| Worker | `noor-portraits-backend` |
| Worker address (currently disabled) | `https://noor-portraits-backend.jincharadzeshako.workers.dev` |
| D1 database | `noor-portraits-db`, `a4d270d9-0c2b-4831-ac98-ff5ac16a880b`, EU jurisdiction / EEUR |
| D1 binding | `DB` |
| Private R2 bucket | `noor-portraits-private`, EU jurisdiction |
| R2 binding | `BUCKET` |
| Scheduled trigger | `17 * * * *` (UTC, hourly) |
| Deployed version | `b4fa60ef-75e5-48e9-a3b8-99e7d01deacf` |
| Vercel project | `noor-portraits`, `prj_AbqZ7iwCPD83X04OzUpUK9ROVkY0` |
| Vercel team | `shakos-projects-82dad3f2`, `team_OktEKJxvEpSupVczeYJdOc0O` |
| Vercel production | `https://noor-portraits.vercel.app` |
| GitHub | `navyforses/noor-portraits` (private), branch `codex/cloudflare-backend` |
| Unmodified fallback Site | `https://noor-portrait-studio.navyforses.chatgpt.site`, `appgprj_6ac8b018bcf88191b4fa916c0a25e0ca` |

## Authentication and secrets

Every Worker request, including static assets, requires `X-NOOR-Gateway-Token` matching `GATEWAY_TOKEN`, except **GET** `/api/health`, which returns only `{"ok":true}`. Token comparison uses SHA-256 digests and constant-time comparison. `workers_dev` and `preview_urls` remain disabled until owner approval. `assets.run_worker_first` enforces the request guard before static asset serving.

Cloudflare secret names: `GATEWAY_TOKEN`, `FILE_SIGNING_KEY`, `MAINTENANCE_KEY`, `ADMIN_SETUP_KEY`. The first three are generated securely and installed via piped stdin. Values are never written into source, logs, documentation, command arguments or commits. `/api/maintenance` additionally requires its existing maintenance authentication. Vercel's gateway blocks that endpoint.

Vercel server-only variables retain the names `NOOR_BACKEND_URL` and `NOOR_BACKEND_TOKEN`, sensitive, Production and Preview. They currently still point to the original private Site. Change both together to the approved Worker address and its gateway token, then redeploy the updated frontend. Never use `NEXT_PUBLIC_` variables for backend credentials.

## Owner's first administrator setup

After cutover, in Cloudflare Dashboard open Workers & Pages → `noor-portraits-backend` → Settings → Variables and Secrets → Add. Choose **Secret**, name `ADMIN_SETUP_KEY`, and privately enter a long random value. Save/deploy it. Do not paste the value into chat.

Then open the ordinary Vercel page `https://noor-portraits.vercel.app/ka/admin`. Its existing setup form has a masked setup-key field and password field. Enter the same setup key directly there and choose an administrator password of at least 14 characters. Do not create, copy or share a URL containing the setup key. The isolated integration suite verifies initial bootstrap and administrator login; production bootstrap remains owner-operated and unverified.

## Existing data

The Sites database contains four packages and three styles, exactly matching `lib/config.ts` defaults. Verified empty: orders, uploads, generated assets, administrator users, settings, localized content, payments, consents, generation jobs, access tokens, analytics events/sessions, audit logs, notifications, order costs/items and revision requests. There are at least 25 transient rate-limit records; these are operational counters, not customer content. They remain in the original Site.

Direct inventory of the old R2 bucket: **ვერ დავადასტურე**. No database-referenced photographs or generated files were found. No original resource or data was deleted or modified. New D1 migrations `0000_clean_nocturne.sql` and `0001_last_mattie_franklin.sql` applied successfully to the fresh database. Catalog seeds the original defaults on its first authenticated request.

## Build and verification

Root uses standard Vinext + Cloudflare Vite plugin and `wrangler.jsonc`; no Sites/connector plugin or ChatGPT sign-in is active in the Worker entry/build. Legacy unused files remain to respect the owner's no-deletion rule. Frontend UI, translations, prices and demo behavior are unchanged: mock payments, manual AI, email off. Current GitHub main's dependency/security fixes are included.

Run with Node 22 or newer and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
node tests/integration.mjs
cd vercel-app
npm ci
npm test
npm run typecheck
npm run build
```

Verified locally: root typecheck/build, **35** isolated integration cases (including missing/wrong gateway tokens, private photographs, stripped EXIF, administrator setup, mock payments, signed downloads, real local scheduled-handler retention and all locale SSR pages); frontend **8** gateway tests, typecheck and production build. The first local integration attempt encountered an ECONNRESET; two subsequent runs passed. The proposed backend CI would run locked dependency installation, root typecheck/build and all 35 isolated integration cases without production secrets. It is not installed. Existing frontend CI is unchanged.

Cloudflare upload and hourly trigger registration succeeded with public URLs disabled. Three secret names were configured without disclosure. Vercel previously returned four packages and three styles in demo mode through the original private Site; its Authentication protection remains enabled for all deployments.

## Remaining verification and cutover

1. Obtain the owner's approval before enabling the reachable Worker URL. This exposes only minimal health without a token; every other request remains guarded. Keep the R2 bucket private and Vercel Authentication enabled.
2. Set `workers_dev: true`, rebuild/deploy, verify health 200, unauthenticated catalog 401, authenticated catalog 200/four packages, and unauthenticated static assets 401.
3. Set both sensitive Vercel variables for Production and Preview, redeploy, verify catalog and `/ar`, `/en`, `/ka`, `/ka/admin`.
4. Confirm a **real Cloudflare scheduled run**, not just registration/local simulation. Completion logs use `noor_scheduled_complete` with cron/time only. Filter tails by that marker; do not capture HTTP headers or credentials.
5. Owner configures `ADMIN_SETUP_KEY` privately and completes the administrator form.
6. Stop after opening the PR for Claude's review. Do not switch Vercel, enable Worker URLs, merge, or broaden OAuth permissions. Existing GitHub checks may run automatically; installing the proposed backend workflow is owner-operated.

Live Worker responses, completed production cutover, real scheduled execution, production administrator setup, and free-plan image-processing CPU adequacy: **ვერ დავადასტურე** at this staging point. The upload fits the free Worker bundle size limit. Local image tests do not prove production CPU adequacy. No paid plan was selected; obtain approval with the exact current price and concrete evidence before any paid upgrade. Real bank/card payments, live image-generation providers and outbound email remain future launch work.

The temporary in-memory secret-transfer process was stopped after the owner deferred cutover. The new Cloudflare secrets remain installed; Vercel variables remain on the original Site. No gateway secret value was retained in a file. A later authorized cutover must generate and securely install a fresh gateway token in both services through stdin; do not attempt to retrieve secret values.
