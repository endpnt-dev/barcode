# endpnt Barcode API — CC Spec
**Version:** 1.1 (updated with PDF-build lessons)
**Date:** April 16, 2026
**Author:** Opus (planning only — CC executes all code changes)
**Agent:** Start with architect → then implementation (single Next.js app, no agent split needed)
**Repo:** `endpnt-dev/barcode`
**Subdomain:** `barcode.endpnt.dev`
**Branch strategy:** Commit and push directly to `main` (no dev branch workflow during pre-launch phase)

---

## ⚠️ READ CC-PREFLIGHT.md FIRST

Before writing ANY code, read `CC-PREFLIGHT.md` in this same directory. It captures 10 lessons from the PDF API build — Next 14 config syntax, local `npm run build` before push, library API verification, native module handling on Vercel, etc. Following that checklist alongside this spec will save multiple build cycles.

---

## Overview

Build the Barcode API — the seventh utility API for endpnt.dev. Generates and decodes linear (1D) barcodes: Code128, EAN-13, EAN-8, UPC-A, UPC-E, Code39, ITF, Codabar, and MSI. This is the companion to the existing QR Code API but for 1D barcodes, which are a distinct product category with different libraries, use cases, and RapidAPI search terms.

The platform decision (per planning): keep barcode SEPARATE from QR rather than merging. Two distinct RapidAPI listings = two search funnels.

Follows the same architecture patterns established across the existing endpnt APIs. QR is the closest analog structurally — its folder layout, auth middleware, rate limit setup, and response format should be used as the template.

Deployed at `barcode.endpnt.dev`.

---

## Current State

Greenfield repo — nothing exists yet. The `endpnt-dev/barcode` GitHub repo has been created with `main` and `dev` branches. Infrastructure already in place:

- GitHub repo: `endpnt-dev/barcode`
- Vercel project: `barcode` linked to the repo, production branch = `main`, **Vercel Pro active**
- DNS: `barcode.endpnt.dev` CNAME → `cname.vercel-dns.com` (Hostinger DNS, verified resolving)
- Upstash Redis: shared `endpnt-ratelimit` database (env vars already set in Vercel)
- Env vars in Vercel: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `API_KEYS` (all applied to Production, Preview, Development)
- Local path: `C:\Repositories\endpnt\barcode\`

**Reference implementation** to copy shared scaffolding from:
- `C:\Repositories\endpnt\qr\` — **primary reference**. Structure, auth, rate limiting, response format, landing page, docs page, pricing page all match what Barcode needs. Copy the scaffolding, swap the business logic.

Secondary references:
- `C:\Repositories\endpnt\convert\` — for multipart upload handling on the decode endpoint
- `C:\Repositories\endpnt\pdf\` — for Next 14 config + webpack externals pattern (if native modules involved)

---

## Requirements

### Generation endpoints
1. **Generate barcode** at `POST /api/v1/generate` — accepts `data` string, `format`, styling; returns PNG/SVG/PDF
2. Support formats: `code128`, `ean13`, `ean8`, `upca`, `upce`, `code39`, `itf`, `codabar`, `msi`
3. Support styling: background color, bar color, text color, width, height, show/hide text, text position, rotation
4. Support output formats: `png` (default), `svg`, `pdf`
5. Return base64-encoded output + metadata

### Decoding endpoints
6. **Decode barcode** at `POST /api/v1/decode` — accepts image (multipart or `image_url`), returns decoded data + format
7. Support decoding same formats as generation
8. Handle multiple barcodes in one image (return array)
9. Max image upload size: 10MB

### Validation endpoint
10. **Validate barcode data** at `POST /api/v1/validate` — pre-generation format/checksum check
11. Return `{ valid, format, checksum_valid, errors }`

### Platform requirements
12. Standard endpnt response envelope (`success`, `data`, `meta.request_id`, `meta.processing_ms`, `meta.remaining_credits`)
13. API key auth via `x-api-key` header (copy from `qr/lib/auth.ts`)
14. Upstash Redis rate limiting
15. Health check at `/api/v1/health`
16. Landing page at `/` (describes API, features, code examples, interactive demo)
17. Interactive docs at `/docs`
18. Pricing page at `/pricing` (identical tier structure to QR)
19. Dark theme, Tailwind, same visual language

---

## Suggestions & Context

### Tech Stack — IMPORTANT: library choice for decoding

**Generation (unchanged):** `bwip-js` — comprehensive library supporting all required 1D formats. Pure JavaScript, ~2MB. Outputs PNG and SVG natively. No native binary concerns.

**Decoding — use `rxing-wasm`, NOT `@zxing/library`.**

⚠️ **Critical library choice rationale (do not deviate without checking with Opus):**

- `@zxing/library` is marked in **maintenance mode** (last release 2024, maintainers stepped back). Its npm page explicitly states: *"While we do not have the time to actively maintain zxing-js anymore."*
- `@zxing/library` is **browser-first**. Server-side Node.js use requires manually constructing `RGBLuminanceSource` from decoded pixel arrays — awkward and error-prone. Known open issues documenting this pain.
- `rxing-wasm` is a **WebAssembly port of a Rust port of ZXing**, actively maintained (49 versions, latest released within 3 months), ~1.3k weekly downloads. Clean API: `decode(imageBuffer)`.
- rxing-wasm is server-friendly — WASM runs the same on Vercel as it does locally. No canvas dependency.

### Complete tech stack:
- **Framework:** Next.js 14+ App Router, TypeScript (same as all endpnt APIs — use Next 14 syntax, see CC-PREFLIGHT.md item 1)
- **Barcode generation:** `bwip-js`
- **Barcode decoding:** `rxing-wasm` (NOT @zxing/library — see above)
- **Image decoding for decode endpoint:** `sharp` (to decode uploaded image into raw pixel buffer for rxing-wasm)
- **PDF output for generate:** `pdf-lib` (single-page PDF containing the barcode image)
- **Rate limiting:** `@upstash/ratelimit` + `@upstash/redis`

**Dependency weight check:** bwip-js (~2MB) + rxing-wasm (~3MB) + sharp (~20MB, already battle-tested) + pdf-lib (~3MB) ≈ 28MB. Well under Vercel Pro 250MB limit.

### Verify library APIs BEFORE writing code

Per CC-PREFLIGHT.md item 3: before calling `rxing-wasm` functions, read its actual API from:
- `node_modules/rxing-wasm/dist/*.d.ts` (TypeScript definitions)
- Or https://github.com/rxing-core/rxing-wasm

Do NOT write barcode decoding code from memory. The exact function signatures matter.

### Folder Structure

```
barcode/
  app/
    api/
      v1/
        generate/route.ts       ← Generate barcode
        decode/route.ts         ← Decode barcode from image
        validate/route.ts       ← Validate data before generating
        health/route.ts
    page.tsx                    ← Landing
    docs/page.tsx               ← Interactive docs
    pricing/page.tsx
    layout.tsx
    globals.css
  lib/
    auth.ts                     ← Copy from qr
    rate-limit.ts               ← Copy from qr
    response.ts                 ← Copy from qr
    config.ts                   ← Copy from qr
    barcode.ts                  ← NEW — generation wrapper around bwip-js
    decode.ts                   ← NEW — decoding wrapper around rxing-wasm
    validate.ts                 ← NEW — format-specific validation rules
  middleware.ts                 ← Copy from qr
  package.json
  tsconfig.json
  next.config.js
  tailwind.config.ts
  postcss.config.js
  .env.example
  vercel.json
  README.md
```

### next.config.js requirements

Use the Next 14 pattern from CC-PREFLIGHT.md item 1. rxing-wasm and sharp both benefit from being externalized:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'rxing-wasm',
      'sharp',
      'bwip-js',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { 'rxing-wasm': 'commonjs rxing-wasm' },
        { 'sharp': 'commonjs sharp' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
```

### Key endpoint parameter shapes

**POST /api/v1/generate**
- `data` (string, required) — data to encode
- `format` (string, required) — `"code128" | "ean13" | "ean8" | "upca" | "upce" | "code39" | "itf" | "codabar" | "msi"`
- `output_format` (string, default `"png"`) — `"png" | "svg" | "pdf"`
- `width` (number, default 2) — width of narrowest bar (bwip-js "scale")
- `height` (number, default 50) — barcode height in px
- `include_text` (boolean, default true)
- `text_size` (number, default 10)
- `background_color` (hex, default `"#FFFFFF"`)
- `bar_color` (hex, default `"#000000"`)
- `text_color` (hex, default `"#000000"`)
- `rotation` (number, default 0) — 0, 90, 180, or 270
- `margin` (number, default 10) — padding in px

**POST /api/v1/decode**
- `image` (file, required*) — multipart upload
- `image_url` (string, required*) — OR URL to fetch from
- `format_hint` (string, optional) — speed up by limiting to specified format
- `multi` (boolean, default false) — detect multiple barcodes
- *One of image or image_url required*

**POST /api/v1/validate**
- `data` (string, required)
- `format` (string, required)

### Standard success response (generate)

```json
{
  "success": true,
  "data": {
    "image": "base64_encoded_output...",
    "output_format": "png",
    "barcode_format": "ean13",
    "data_encoded": "5901234123457",
    "width": 270,
    "height": 70,
    "file_size_bytes": 1240
  },
  "meta": {
    "request_id": "req_a1b2c3",
    "processing_ms": 45,
    "remaining_credits": 4847
  }
}
```

### Standard success response (decode)

```json
{
  "success": true,
  "data": {
    "detections": [
      {
        "data": "5901234123457",
        "format": "ean13",
        "confidence": 0.98,
        "position": { "x": 120, "y": 45, "width": 270, "height": 70 }
      }
    ],
    "total_detected": 1
  },
  "meta": { ... }
}
```

### Standard success response (validate)

```json
{
  "success": true,
  "data": {
    "valid": true,
    "format": "ean13",
    "checksum_valid": true,
    "checksum_digit": 7,
    "errors": []
  },
  "meta": { ... }
}
```

### Error codes

Platform errors:
- `AUTH_REQUIRED` (401)
- `INVALID_API_KEY` (401)
- `RATE_LIMIT_EXCEEDED` (429)
- `INVALID_PARAMS` (400)

Barcode-specific errors:
- `UNSUPPORTED_FORMAT` (400)
- `INVALID_DATA_FOR_FORMAT` (400)
- `INVALID_CHECKSUM` (400)
- `INVALID_LENGTH` (400)
- `FILE_TOO_LARGE` (400)
- `INVALID_IMAGE` (400)
- `NO_BARCODE_FOUND` (404)
- `IMAGE_FETCH_FAILED` (400)
- `PROCESSING_FAILED` (500)

### Format validation rules (build into lib/validate.ts)

Implement format-specific validation BEFORE handing off to bwip-js — catch errors early with helpful messages. bwip-js throws cryptic errors on bad input.

- **EAN-13**: 12 digits (13th is checksum, calculated) or 13 digits (checksum validated)
- **EAN-8**: 7 digits (8th is checksum) or 8 digits
- **UPC-A**: 11 digits (12th is checksum) or 12 digits
- **UPC-E**: 6, 7, or 8 digits
- **Code128**: any ASCII characters, 1-80 chars typical
- **Code39**: uppercase A-Z, 0-9, and `-. $/+%*` only
- **ITF**: even number of digits only
- **Codabar**: 0-9 and `-$:/.+` with start/stop chars `ABCD`
- **MSI**: digits only, variable length

Mod 10 checksum calculation for EAN/UPC: implement properly, don't rely on library validation.

### Landing page (`/`)

Hero: "Generate and decode barcodes. 9 formats, one API."

Features:
- 9 barcode formats supported
- Generate PNG, SVG, or PDF
- Decode from any image
- Customizable colors, sizes, rotation
- Free tier: 100 generations/month

Interactive demo: Format dropdown + data input + live preview.

Code examples: cURL + Node.js + Python for generate and decode.

### Docs page (`/docs`)

Sidebar:
```
Getting Started
  ├─ Authentication
  └─ Rate limits
Generate
  └─ POST /generate
Decode
  └─ POST /decode
Validate
  └─ POST /validate
Formats
  ├─ Code128
  ├─ EAN-13 / EAN-8
  ├─ UPC-A / UPC-E
  ├─ Code39
  ├─ ITF
  ├─ Codabar
  └─ MSI
```

### Pricing page (`/pricing`)

Match QR pricing exactly:
- Free: 100/month
- Starter: $9/mo for 10,000
- Pro: $29/mo for 100,000
- Scale: $99/mo for 1M

### Dependencies to install

```bash
npm install bwip-js rxing-wasm sharp pdf-lib @upstash/ratelimit @upstash/redis lucide-react next react react-dom
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss postcss autoprefixer eslint eslint-config-next @tailwindcss/typography
```

Match Next.js, React, TypeScript versions from `C:\Repositories\endpnt\qr\package.json`.

---

## Key Discoveries

1. **bwip-js handles generation for all 9 formats.** Don't mix libraries.

2. **rxing-wasm is the right decoder, NOT @zxing/library.** The latter is in maintenance mode AND is browser-first (server use requires awkward pixel-buffer gymnastics). rxing-wasm is actively maintained and designed for Node/WASM.

3. **Decode flow uses sharp to prep images.** rxing-wasm needs raw pixel data. Use sharp to decode the uploaded image into `{ data: Buffer, info: { width, height } }`, then pass to rxing-wasm.

4. **Checksum validation is format-specific and non-trivial.** EAN/UPC use Mod 10 with specific weighting. Build into lib/validate.ts. Validate first, generate second.

5. **SVG output is lightweight and underrated.** Many customers prefer SVG (scales without pixelation). Test well.

6. **Rotation in bwip-js uses its built-in option.** Don't post-hoc canvas-rotate — breaks text positioning.

7. **QR repo's `lib/` files are the pattern.** Copy auth.ts, rate-limit.ts, response.ts, config.ts verbatim. Proven across multiple APIs.

8. **Multi-barcode decoding is a premium feature.** Worth supporting from v1. rxing-wasm has `decode_multi` functionality.

---

## DO NOT TOUCH

- Any files in other endpnt API repos
- The existing Upstash Redis database schema
- Hostinger DNS records
- Vercel project settings (already linked to repo)
- Environment variables in Vercel dashboard — use the 3 that are already set

---

## Edge Cases

1. **Invalid data for format** — e.g., "ABC" for UPC-A. Return `INVALID_DATA_FOR_FORMAT`.
2. **Wrong length for format** — Return `INVALID_LENGTH` with expected length.
3. **Provided checksum but wrong** — Return `INVALID_CHECKSUM` with correct checksum shown.
4. **Special characters in Code39** — Reject with helpful list of allowed chars.
5. **Color contrast too low** — Generation succeeds but barcode may be unscannable. Warn in meta, don't block.
6. **Non-right-angle rotation** — Reject, only 0/90/180/270 supported.
7. **Decode image with no barcode** — Return `NO_BARCODE_FOUND` with empty detections.
8. **Partial/damaged barcode** — Include confidence score in response.
9. **Multiple barcodes when `multi: false`** — Return highest-confidence detection only.
10. **Very small barcodes in decode image** — May be undetectable, return `NO_BARCODE_FOUND`.
11. **Transparent background on PDF output** — Reject with helpful message (PDF doesn't support transparency well).
12. **Zero-width or zero-height** — Reject at param validation.
13. **Extremely long Code128 data** — Allow up to 200 chars, warn in meta beyond 100.
14. **ITF with odd digit count** — Reject with clear error.
15. **SVG must be self-contained** — No external font references.

---

## Git Commit

```bash
# MANDATORY: verify local build passes before push (CC-PREFLIGHT.md item 2)
npm run build

# Only if exit 0:
git add -A && git commit -m "feat: initial build — endpnt Barcode API v1 (9 formats, generate/decode/validate)"
git push origin main
```

Vercel auto-deploys to `barcode.endpnt.dev`.

---

## Smoke Tests

Run against `https://barcode.endpnt.dev` after deploy. Use the shared test API key (`ek_live_test001`).

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Health check responds | `GET /api/v1/health` | 200 with `{ status: "ok", version }` | |
| 2 | Missing API key returns 401 | `POST /api/v1/generate` without header | 401 with `AUTH_REQUIRED` | |
| 3 | Invalid API key returns 401 | With `x-api-key: invalid` | 401 with `INVALID_API_KEY` | |
| 4 | Rate limit enforced | Burst 20 requests on free tier | Requests 11+ return 429 | |
| 5 | Generate EAN-13 | `POST /generate` with `{ data: "5901234123457", format: "ean13" }` | 200 with base64 PNG | |
| 6 | Generate UPC-A | `POST /generate` with UPC-A | 200 with base64 PNG | |
| 7 | Generate Code128 | `POST /generate` with Code128 | 200 with base64 PNG | |
| 8 | Generate SVG output | `POST /generate` with `output_format: "svg"` | 200 with SVG content | |
| 9 | Generate PDF output | `POST /generate` with `output_format: "pdf"` | 200 with base64 PDF that opens | |
| 10 | Custom colors | `POST /generate` with `bar_color: "#0000FF"` | Blue bars on yellow bg | |
| 11 | Rotation 90° | `POST /generate` with `rotation: 90` | Dimensions rotated | |
| 12 | Hide text | `POST /generate` with `include_text: false` | No text below bars | |
| 13 | Invalid data for format | `POST /generate` with `{ data: "ABC", format: "upca" }` | 400 `INVALID_DATA_FOR_FORMAT` | |
| 14 | Wrong length | `POST /generate` with `{ data: "12345", format: "ean13" }` | 400 `INVALID_LENGTH` | |
| 15 | Invalid checksum | `POST /generate` with bad EAN-13 checksum | 400 `INVALID_CHECKSUM` | |
| 16 | Validate endpoint | `POST /validate` with valid EAN-13 | 200 with `valid: true` | |
| 17 | Validate catches bad checksum | `POST /validate` with bad EAN-13 | 200 with `valid: false` | |
| 18 | Decode from upload | `POST /decode` with known EAN-13 PNG | 200, detected data matches | |
| 19 | Decode from URL | `POST /decode` with `image_url` | 200 with detections | |
| 20 | Decode returns no barcode | `POST /decode` with landscape photo | 404 `NO_BARCODE_FOUND` | |
| 21 | Decode multiple barcodes | `POST /decode` with `multi: true` on 2-barcode image | detections array length 2 | |
| 22 | Invalid image on decode | `POST /decode` with .txt file | 400 `INVALID_IMAGE` | |
| 23 | File too large on decode | `POST /decode` with 15MB image | 400 `FILE_TOO_LARGE` | |
| 24 | Unsupported format | `POST /generate` with `format: "qr"` | 400 `UNSUPPORTED_FORMAT` | |
| 25 | Landing page loads | Visit root | Renders, demo visible | |
| 26 | Docs page loads | Visit `/docs` | All 9 formats documented | |
| 27 | Pricing page loads | Visit `/pricing` | Matches QR pricing | |
| 28 | Response includes meta fields | Any call | meta fields present | |
| 29 | CORS preflight | `OPTIONS /api/v1/generate` | 204 with CORS headers | |
| 30 | Credits decrement | Two generate calls | Count decreases by 1 each | |
| 31 | No "Invalid next.config.js" warning | Check Vercel build logs | Clean, no warnings | |
| 32 | Local build passed before push | Verify in commit history | `npm run build` ran successfully | |

---

## Post-Implementation

After CC completes the build and all smoke tests pass:

1. Use review-qa-agent to verify implementation against spec
2. Verify RapidAPI listing can reference all 3 endpoints
3. Add Barcode API to hub site (`endpnt.dev`) — separate micro spec for web repo
4. Update platform docs/README to reflect new API count

## Fallback if rxing-wasm has issues on Vercel

If rxing-wasm fails to bundle properly despite the next.config.js externals, alternatives in order of preference:

1. **`@deviceflow/rxing-wasm`** — fork of rxing-wasm with its own maintenance (same API, 739 downloads/month)
2. **`@zxing/library`** — the maintenance-mode fallback. Requires manually constructing `RGBLuminanceSource` from sharp-decoded pixel arrays. Functional but awkward.
3. **Contact Opus for a new library choice** — don't spend >2 hours on library debugging before escalating.
