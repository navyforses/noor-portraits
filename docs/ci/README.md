# Proposed backend CI

`cloudflare-backend.proposed.yml` is a plain proposal, not an active GitHub Actions workflow. The owner will review and install it manually if desired. This pull request does not change `.github/workflows/` or request additional GitHub OAuth permissions.

The proposal uses Node 22 and pnpm 11.25.0, installs the locked dependencies, runs the root TypeScript check, builds the independent Worker, and runs all 35 integration cases against isolated Miniflare D1/R2 fixtures. It neither deploys nor accesses production credentials. The existing frontend workflow is unchanged and continues to test, typecheck, build and audit `vercel-app`.
