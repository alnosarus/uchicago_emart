# Security Review Report — UChicago Marketplace

**Date:** 2026-04-01
**Scope:** `apps/api/`, `apps/web/`, `packages/shared/`, root configuration
**Status:** Pre-production

---

## Summary

18 findings total: 1 Critical, 4 High, 9 Medium, 3 Low, 1 Info.

The most urgent issue is live secrets on disk (`.env`). The High-severity findings are auth bugs: no rate limiting, mass assignment in profile update, phone verification bypass, and no refresh token revocation. All High issues should be fixed before any public deployment.

---

## Findings

### CRITICAL

#### SEC-01: Live Production Secrets in `.env`

**File:** `/.env` (lines 5-23)

The `.env` file contains real credentials: PostgreSQL password, Google OAuth client secret, JWT signing secrets, and a base64-encoded Firebase service account with RSA private key. While `.gitignore` excludes `.env`, anyone with filesystem access gets full database and admin control.

**Remediation:** Rotate ALL secrets (DB password, Google client secret, JWT secrets, Firebase service account key). Use Railway environment variables for production instead of `.env`. Add a pre-commit hook with `gitleaks` to prevent accidental commits.

---

### HIGH

#### SEC-02: No Rate Limiting on Auth Endpoints

**File:** `apps/api/src/index.ts`, `apps/api/src/routes/auth.ts`

No rate limiting middleware anywhere. Attackers can trigger unlimited Firebase SMS sends (cost attack), brute-force token refresh, or overwhelm Google token exchange.

**Remediation:** Install `express-rate-limit`. Apply strict limits: `/auth/google` 10 req/min per IP, `/auth/verify-phone` 3 req/min per IP.

---

#### SEC-03: Mass Assignment in Profile Update

**File:** `apps/api/src/routes/users.ts:77`

```typescript
data: req.body,
```

The profile update passes `req.body` directly to Prisma. While Zod strips unknown keys, the `phone` field is in the schema — meaning users can set their phone to any string, bypassing verification.

**Remediation:** Explicitly pick allowed fields before passing to Prisma. Never pass `req.body` directly to a database update.

---

#### SEC-04: Phone Verification Bypass via Profile Update

**File:** `apps/api/src/routes/users.ts:63-67`, `apps/api/src/services/auth.service.ts:62-71`

Two problems:
1. `PATCH /api/users/me` allows setting `phone` directly, bypassing Firebase SMS verification.
2. `sendPhoneVerification()` stores the phone number *before* verification succeeds.

**Remediation:** Remove `phone` from the profile update schema. Don't persist phone until `confirmPhoneVerification` succeeds. Validate that the verified phone matches the one submitted.

---

#### SEC-05: No Refresh Token Revocation or Rotation

**File:** `apps/api/src/services/auth.service.ts:94-105`, `apps/api/src/routes/auth.ts:89-92`

Refresh tokens are stateless JWTs. Logout only clears the cookie — a stolen token remains valid for 7 days. No rotation on refresh, no server-side token store.

**Remediation:** Store refresh tokens in the database. Implement rotation (new token on each refresh, invalidate the old one). Invalidate all tokens on logout.

---

### MEDIUM

#### SEC-06: No CSRF Protection

**File:** `apps/api/src/index.ts:16-19`, `apps/api/src/routes/auth.ts:22-29`

CORS allows credentials. Refresh token cookie is `sameSite: "lax"` which protects POST routes but not future GET state-changing endpoints.

**Remediation:** Implement CSRF token validation. Consider `sameSite: "strict"` for the refresh cookie.

---

#### SEC-07: CORS Hardcoded to Localhost

**File:** `apps/api/src/index.ts:16-19`

```typescript
origin: ["http://localhost:3001", "http://localhost:8081"],
```

No mechanism for production origins. Risk of someone setting `origin: "*"` as a quick fix during deployment.

**Remediation:** Make CORS origins configurable via env var (e.g., `CORS_ORIGINS`).

---

#### SEC-08: Refresh Token Cookie `secure` Flag Depends on NODE_ENV

**File:** `apps/api/src/routes/auth.ts:25`

If `NODE_ENV` is misconfigured in production, the cookie transmits over plain HTTP.

**Remediation:** Default to `secure: true`. Only disable explicitly for local dev.

---

#### SEC-09: No Request Body Size Limit

**File:** `apps/api/src/index.ts:21`

`express.json()` uses the default 100KB limit but it's not explicitly set.

**Remediation:** Set `express.json({ limit: '100kb' })` explicitly.

---

#### SEC-10: JWT Algorithm Not Pinned

**File:** `apps/api/src/middleware/auth.ts:19`, `apps/api/src/services/auth.service.ts:107-117`

`jwt.verify()` doesn't specify `{ algorithms: ['HS256'] }`. While `jsonwebtoken` v9+ mitigates the `none` algorithm attack, explicit pinning is defense-in-depth.

**Remediation:** Add `{ algorithms: ['HS256'] }` to all `jwt.verify()` calls.

---

#### SEC-11: Domain Check Relies Only on `hd` Claim

**File:** `apps/api/src/services/auth.service.ts:28-31`

Only checks `payload.hd !== "uchicago.edu"`. No secondary check on the email suffix.

**Remediation:** Add `if (!payload.email.endsWith('@uchicago.edu'))` as a belt-and-suspenders check.

---

#### SEC-12: Full User Object Returned on Login

**File:** `apps/api/src/services/auth.service.ts:52-59`

Login returns the full Prisma user object including `googleId`, `updatedAt`, etc. The `/me/profile` endpoint correctly uses `select`, but login does not.

**Remediation:** Use Prisma `select` in `loginWithGoogle()` to return only client-needed fields.

---

#### SEC-13: Phone Stored Before Verification

**File:** `apps/api/src/services/auth.service.ts:62-71`

`sendPhoneVerification()` writes the phone to the user record before SMS is confirmed.

**Remediation:** Only persist phone after `confirmPhoneVerification` succeeds.

---

#### SEC-14: Public User Profile Endpoint

**File:** `apps/api/src/routes/users.ts:11-33`

`GET /api/users/:id` is unauthenticated. Returns name, avatar, verification status, creation date. UUIDs prevent enumeration but IDs may be exposed via post data.

**Remediation:** Document as intentional. Consider privacy controls later.

---

### LOW

#### SEC-15: Dependency Vulnerabilities

**File:** `pnpm-lock.yaml`

- HIGH: `effect` < 3.20.0 (via Prisma) — AsyncLocalStorage context leak under concurrency
- LOW: `@tootallnate/once` < 3.0.1 (via Firebase Admin SDK)

**Remediation:** Update Prisma. Monitor Firebase SDK for upstream fix.

---

#### SEC-16: Health Endpoint Exposes DB Status

**File:** `apps/api/src/routes/health.ts:6-13`

`/api/health` reveals whether database is connected/disconnected. Aids reconnaissance in production.

**Remediation:** Return minimal info (200/503) publicly. Require API key for detailed status.

---

#### SEC-17: `dangerouslySetInnerHTML` in Mobile (Safe)

**File:** `apps/mobile/app/+html.tsx:22`

Uses hardcoded CSS constant. No user input. Standard Expo pattern. Not exploitable.

**Remediation:** None.

---

### INFO

#### SEC-18: Access Token in React State (Good Practice)

**File:** `apps/web/src/lib/auth-context.tsx:29`

Token stored in memory only — not localStorage. Cleared on refresh, not accessible to XSS targeting storage APIs. This is the recommended approach.

**Remediation:** None.

---

## Priority Order

1. **Immediate:** SEC-01 — Rotate all secrets
2. **Before launch:** SEC-02, SEC-03, SEC-04, SEC-05 — Rate limiting, mass assignment, phone bypass, token revocation
3. **Before launch:** SEC-06 through SEC-13 — CSRF, CORS config, JWT pinning, domain check, body limits
4. **Ongoing:** SEC-15 — Dependency updates
