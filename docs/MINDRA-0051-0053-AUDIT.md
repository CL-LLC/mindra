# MINDRA-0051 / MINDRA-0052 / MINDRA-0053 Audit

## Scope
Audit current Mindra repo for:
- Clerk leftovers
- Convex native auth status
- Vercel beta deployment readiness for 5-10 testers

## Findings

### 1. Clerk code status
Runtime auth is already on Convex native auth.
Evidence:
- `src/middleware.ts` uses `@convex-dev/auth/nextjs/server`
- `src/lib/convex-provider.tsx` uses `ConvexAuthNextjsProvider`
- `convex/auth.ts` defines providers with Convex auth
- `src/app/sign-in/page.tsx` uses Convex auth actions for Google + email magic link

### 2. Remaining Clerk leftovers
Not active in runtime, but still present in repo:
- `package.json` still includes `@clerk/nextjs`
- `package-lock.json` still resolves Clerk packages
- `.env.example` still starts with Clerk auth comments
- `README.md` still references Clerk
- `docs/PRODUCT-SPEC.md`, `docs/QUICK_START.md`, `test-full-integration.js` still reference Clerk
- `docs/CONVEX-AUTH-PLAN.md` is historical migration material, not a blocker

### 3. Auth readiness for MVP
Current MVP auth path in code:
- Google OAuth
- Email magic link (`resend` provider path in sign-in flow)

User-confirmed validation in channel:
- Google OAuth login/registration tested and working great

Repo evidence supporting readiness:
- Convex auth tables are included in `convex/schema.ts`
- Google provider configured in `convex/auth.ts`
- Next.js middleware/provider wiring present
- Token handoff for API render route present

### 4. Immediate blockers before Vercel deploy
Main blocker is not architecture; it is cleanup and deployment execution:
- remove stale Clerk dependency from package.json / lockfile
- clean docs/env examples so deployment instructions match reality
- confirm required production env set for Google + Convex + email provider
- deploy branch to Vercel and smoke test auth on hosted URL

## Deployment blueprint (beta)

### Hosting topology
- Frontend: Vercel
- Backend/auth/data: Convex
- MVP testers: 5-10
- Auth: Google OAuth + email magic link

### Required checks before deploy
1. Remove inactive Clerk dependency and stale references
2. Verify production env vars in Vercel and Convex
3. Build locally
4. Deploy preview
5. Run hosted smoke test:
   - landing page
   - Google sign-in
   - email magic link sign-in
   - dashboard access
   - create flow load
   - logout / relogin

### Suggested launch gate
Ship to testers when:
- auth passes on hosted deployment
- no fatal app-shell error on login/dashboard/create
- one full user journey succeeds on Vercel

## Recommendation
Proceed directly to cleanup branch + PR, then Vercel deployment.
