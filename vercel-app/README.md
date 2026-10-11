# NOOR Portraits on Vercel

This Next.js app preserves the original Arabic, English and Georgian storefront and administration UI. The original Cloudflare source remains at the repository root.

Vercel serves the interface and a server-only API gateway. The existing NOOR Sites backend retains D1 orders, authentication, payment-demo state and private R2 files. No database or customer portraits are copied into GitHub or this app.

## Configuration

- Vercel Root Directory: `vercel-app`
- Framework: Next.js
- Install: `npm ci`; Build: `npm run build`
- `NOOR_BACKEND_URL`: the exact existing NOOR backend origin
- `NOOR_BACKEND_TOKEN`: an encrypted server-only Sites credential. It is never a `NEXT_PUBLIC_` variable, never checked into Git, and must only be configured after the owner explicitly approves transfer to Vercel.
- Retain Vercel Authentication protection for production and preview.

Without the approved backend credential, API operations return 503. The interface can render, but ordering, uploads and administration are not operational until the connection is approved and verified.

The gateway validates same-origin mutations, forwards only NOOR session cookies, rejects redirects and arbitrary upstream hosts, blocks maintenance, limits request bodies to 4 MB, streams private downloads, and rewrites administrator-issued customer links to the Vercel deployment.

The original application still uses demo payment, manual AI fulfillment and disconnected email. Deployment does not enable paid sales or live image generation. Existing backend cleanup scheduling retains its prior verification status.

## Checks

`npm test`, `npm run typecheck`, `npm run build`

Gateway tests use synthetic credentials and requests, never production customer data.
