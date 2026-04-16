# CC Pre-Flight Checklist — Read This Before Writing Any Code

This checklist captures hard-won lessons from the endpnt PDF API build. Follow it for EVERY endpnt API build to avoid repeating the 12-build-failure cycle that PDF went through.

---

## 1. Next.js 14 config syntax (NOT Next 15)

This project uses **Next 14.2.x**, not Next 15. The config keys are different between versions, and CC's training data may default to Next 15 patterns.

### ✅ Correct for Next 14:
```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['package-name'],
  },
}
```

### ❌ WRONG (this is Next 15 syntax):
```javascript
const nextConfig = {
  serverExternalPackages: ['package-name'],  // top-level — Next 15 only
  turbopack: {},  // Next 15 only
}
```

If you write Next 15 syntax, the build will fail with:
```
Invalid next.config.js options detected:
Unrecognized key(s) in object: 'serverExternalPackages', 'turbopack'
```

**Verification reference:** https://nextjs.org/docs/14/app/api-reference/next-config-js/serverComponentsExternalPackages

---

## 2. Mandatory local build before every push

**DO NOT `git push` without first running `npm run build` locally and confirming exit code 0.**

Every Vercel build failure costs a full CI cycle. Local builds catch the same errors in under 30 seconds.

### Workflow:
```bash
npm run build           # MUST pass before push
# If exit 0, proceed:
git add -A
git commit -m "..."
git push origin main
```

### If `npm run build` fails:
Fix the error locally. Re-run. Do NOT push in hopes of a different outcome on Vercel.

---

## 3. Library API verification — don't trust training data

During the PDF build, CC hallucinated pdf-lib API options twice:
- `addDefaultPrefixToObjectStreams` (doesn't exist)
- `password` as a LoadOptions property (doesn't exist)

Both would have been caught by reading the actual library docs BEFORE writing the code.

### Rule:
For any library function you're about to call with an options object, verify the options parameter shape by:
1. Reading the library's TypeScript definitions (`node_modules/<lib>/dist/*.d.ts`)
2. Or checking the library's official API docs
3. NOT relying on memory alone

If TypeScript compilation catches an options mismatch, you hallucinated — rewrite that call using verified options only.

---

## 4. Native modules on Vercel

Packages with `.node` binaries (like `@napi-rs/canvas`) OR external binary dependencies (like `qpdf`) require special handling:

### In `next.config.js`:
```javascript
experimental: {
  serverComponentsExternalPackages: [
    '@napi-rs/canvas',
    // ...other native packages
  ],
},
webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals = [
      ...(config.externals || []),
      { '@napi-rs/canvas': 'commonjs @napi-rs/canvas' },
    ];
  }
  return config;
},
```

### Vercel build environment:
- Does NOT have `apt-get` (Amazon Linux-based, no root access)
- Does NOT allow installing system packages during build
- DOES support bundling binaries via `outputFileTracingIncludes`
- Binaries placed in `bin/` must be referenced by path, NOT imported

### If you need a system binary (like qpdf):
1. Download the Linux x86_64 binary
2. Place in `bin/<binary-name>/` inside the repo
3. Add to `next.config.js`:
```javascript
outputFileTracingIncludes: {
  '/api/v1/your-route': ['./bin/<binary>/**/*'],
},
```
4. Chmod +x at runtime (tracing may strip executable bit)

---

## 5. Verify third-party libraries are actually maintained

Check before using:
- When was the last npm release?
- Any GitHub "unmaintained" / "maintenance mode" notices?
- Weekly downloads trending down?

If a library hasn't shipped a release in 18+ months, search for actively-maintained alternatives. Don't build on abandoned libraries for a production API.

---

## 6. Error handling categorization

Every route handler must catch errors and map them to specific error codes, not generic 500s.

### Pattern:
```typescript
try {
  // ... operation
} catch (error: any) {
  const message = error.message || '';
  
  if (message.includes('<specific error indicator>')) {
    return errorResponse('SPECIFIC_ERROR_CODE', 'Helpful message', 400);
  }
  
  console.error('Operation error:', message);
  return errorResponse('PROCESSING_FAILED', 'Operation failed', 500);
}
```

Generic 500s with opaque messages are a bad customer experience. Invest in error categorization.

---

## 7. /tmp file cleanup in serverless

If you write temp files during a request (for binary wrappers like qpdf), ALWAYS use try/finally to delete them:

```typescript
const inputPath = join(tmpdir(), `op-${randomUUID()}.pdf`);
try {
  await writeFile(inputPath, buffer);
  // ... do work
  return result;
} finally {
  await unlink(inputPath).catch(() => {});
}
```

Without finally, /tmp fills up across invocations and functions start failing with "ENOSPC: no space left on device."

---

## 8. Standard response envelope

Every endpnt API uses this response shape:

### Success:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_a1b2c3",
    "processing_ms": 245,
    "remaining_credits": 4847
  }
}
```

### Error:
```json
{
  "success": false,
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "message": "Human-readable explanation"
  },
  "meta": {
    "request_id": "req_a1b2c3"
  }
}
```

Use the shared helpers from `lib/response.ts` (copied from validate/qr repos). Don't invent a new shape.

---

## 9. Shared env vars (already set in Vercel)

These three env vars are ALREADY configured in Vercel for this project:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `API_KEYS` (JSON string containing test keys)

DO NOT re-create these locally with different values. DO NOT rename them. Use them as-is.

---

## 10. Stopping conditions

Stop and escalate to a fix spec (rather than pushing again) if:
- Same build error repeats across 2+ attempts
- CC-generated fix contradicts the spec
- A library API doesn't match TypeScript definitions
- Build succeeds locally but fails on Vercel with a new error class

The correct response is: stop pushing, write a fix spec with web-verified facts, then proceed.
