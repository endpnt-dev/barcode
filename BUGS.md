# BUGS.md — Barcode API Bug Tracker

**Scope:** Bugs specific to the Barcode API (`barcode.endpnt.dev`). Cross-cutting bugs live at `../BUGS.md`.

**ID prefix:** `B-NNN` (sequential, do not reuse).

**Last updated:** 2026-04-24 (created by first biweekly code health audit).

---

## Open bugs

### B-001 — SSRF in `fetchImageFromUrl` (decode endpoint, image_url)

- **Severity:** High (launch blocker)
- **File:** `lib/decode.ts` line ~75 — `fetchImageFromUrl()` function
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** The `/api/v1/decode` route accepts an `image_url` parameter that gets passed to `fetch(url, ...)` with no SSRF protection. No private-IP blocklist, no `redirect: 'manual'`, no redirect re-validation. An attacker can submit `{"image_url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}` and the Vercel function will fetch AWS IMDS on their behalf.
- **Root cause:** Same pattern as convert C-001 — URL-fetching code written before SSRF conventions were established platform-wide.
- **Impact:** IMDS exfiltration of IAM credentials, port-scanning of private Vercel network from egress IPs, DNS-based internal reconnaissance. Pre-launch blocker.
- **Fix approach:**
  1. Copy `preview/lib/url-utils.ts` (`isSSRFProtected()`) into `barcode/lib/url-utils.ts`.
  2. Call `isSSRFProtected(url)` BEFORE the `fetch()` in `fetchImageFromUrl`.
  3. Set `redirect: 'manual'` and re-validate the post-redirect URL.
  4. Add `BLOCKED_IMAGE_URL` error code to `lib/config.ts`.
  5. Add smoke tests for 169.254.169.254, 127.0.0.1, 10.0.0.1, ::1.
- **Cross-reference:** `../BUGS.md#P-003`
- **Status:** Open. Launch blocker. No spec yet.

### B-002 — Unbounded response size in `fetchImageFromUrl`

- **Severity:** High (launch blocker)
- **File:** `lib/decode.ts` — `fetchImageFromUrl()` function
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** `fetchImageFromUrl` checks `content-length` header for size but trusts the declared value. A malicious server can omit the header or lie about it and stream arbitrarily large data into the function. The buffer is loaded via `response.arrayBuffer()` with no streaming byte counter.
- **Root cause:** Header-trust pattern; streaming byte-counting deferred.
- **Impact:** OOM via memory exhaustion attack. Attacker doesn't need to control the target server — they just need any server that can be made to respond with a large body (or a redirect chain to one).
- **Fix approach:** Replace `response.arrayBuffer()` with a streaming reader that counts bytes and aborts when the limit is exceeded. Return `FILE_TOO_LARGE` error at that point. Bundle with B-001 fix (same function).
- **Status:** Open. Launch blocker. Bundle fix with B-001 spec.

### B-003 — No `vercel.json` — unverified resource allocation for WASM workloads

- **Severity:** Medium
- **File:** `vercel.json` (absent)
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** Barcode has no `vercel.json`, meaning all routes run at Vercel's default resource allocation. The decode route loads `rxing-wasm` (a WASM module) on cold start — WASM initialization can be memory-intensive and slow. Without explicit `memory` and `maxDuration` settings, cold-start OOM or timeout is possible under load.
- **Root cause:** No explicit resource config was added during initial build.
- **Impact:** Potential cold-start failures under load. Currently unverified — may be adequate at defaults.
- **Fix approach:** Add `vercel.json` with at minimum `{ "functions": { "app/api/v1/decode/route.ts": { "maxDuration": 30, "memory": 1024 } } }`. Verify that cold-start time is acceptable under Vercel Pro defaults.
- **Status:** Open. Medium priority — verify before launch.

### B-004 — `remaining_credits` off-by-one in success responses

- **Severity:** Low
- **Files:** `app/api/v1/generate/route.ts`, `app/api/v1/decode/route.ts`
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** Both routes report `remaining_credits: rateLimitResult.remaining - 1` in success responses. `@upstash/ratelimit` already returns the post-decrement `remaining` value from `.limit()` — the manual `- 1` results in reporting one fewer credit than the customer actually has.
- **Root cause:** Misunderstanding of Upstash's return semantics.
- **Impact:** Cosmetic — customers see slightly fewer remaining credits than they have. May cause confusion for customers managing quota programmatically.
- **Fix approach:** Change `rateLimitResult.remaining - 1` to `rateLimitResult.remaining` in both routes.
- **Status:** Open. Low priority. Fix with next touch to these routes.

### B-005 — Health endpoint at non-standard path `/api/health`

- **Severity:** Low
- **File:** `app/api/health/route.ts`
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** Barcode's health endpoint is at `/api/health` while all other platform APIs use `/api/v1/health`. This causes the audit's standardized health check (`curl .../api/v1/health`) to return an HTML 404 for barcode.
- **Root cause:** Health route was placed at root `api/` level rather than versioned `api/v1/` level during initial scaffolding.
- **Impact:** Breaks any automated monitoring or healthcheck script using the standard `/api/v1/health` path. Mismatch with API catalog.
- **Fix approach:** Move `app/api/health/` to `app/api/v1/health/`. Update any references.
- **Status:** Open. Low priority. Fix with next touch to barcode.

---

## Resolved bugs

*(None resolved yet — file created 2026-04-24.)*

---

## Bug entry template

```markdown
### B-XXX — [Short descriptive title]

- **Severity:** Critical | High | Medium | Low
- **File:** [path]
- **Discovered:** [YYYY-MM-DD, context]
- **Symptom:** [observable behavior]
- **Root cause:** [best-known explanation]
- **Impact:** [customer/security risk]
- **Fix approach:** [high-level plan]
- **Cross-reference:** [related bugs if any]
- **Status:** Open | In progress | Awaiting deployment
```
