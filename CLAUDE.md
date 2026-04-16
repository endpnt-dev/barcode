# CLAUDE.md — Barcode API Specific Rules

**This file supplements `C:\Repositories\endpnt\CLAUDE.md` (platform-wide rules).** Read both. Universal rules (definition of done, mandatory workflow, agent usage, status-report honesty, etc.) are in the platform file. Only Barcode-specific guidance lives here.

---

## Library Choices

| Library | Purpose | Why this one |
|---|---|---|
| `bwip-js` | Generation (all 9 1D formats) | Pure JS, covers every required format with one library |
| `rxing-wasm` | Decoding | Actively maintained (WASM port of Rust port of ZXing). **Do NOT use `@zxing/library`** — it's in maintenance mode and browser-first |
| `sharp` | Image preprocessing for decode | Decodes uploaded images to raw pixel buffers for rxing-wasm |
| `pdf-lib` | PDF output format | Same library PDF API uses |

---

## Decoder: rxing-wasm, NOT @zxing/library

**Critical library choice — do not deviate.**

`@zxing/library` has **288k weekly downloads and is marked maintenance-only**. Its npm page states: "While we do not have the time to actively maintain zxing-js anymore." It's also browser-first — server-side Node.js use requires awkward `RGBLuminanceSource` construction from decoded pixel arrays.

`rxing-wasm` is the actively-maintained successor — 49 versions, latest released within 3 months, ~1.3k weekly downloads. Designed for Node.js and WASM environments. Clean API.

If CC tries to swap to `@zxing/library` because it's "more popular," the answer is NO. Popularity is a trailing indicator — ZXing is popular because it was the only option for years, not because it's the best choice today.

---

## Image Preprocessing Flow for /decode

rxing-wasm needs raw pixel data, not an image file. The flow:

```typescript
// 1. Accept image via multipart or image_url
const imageBuffer = /* ... get the image bytes ... */;

// 2. Use sharp to decode into raw pixels
const { data, info } = await sharp(imageBuffer)
  .raw()
  .toBuffer({ resolveWithObject: true });

// 3. Pass to rxing-wasm
const result = decodeBarcode(data, info.width, info.height);
```

Verify the exact rxing-wasm API in `node_modules/rxing-wasm/dist/*.d.ts` before implementing. The function name and signature may differ from the pattern above.

---

## Format Validation (build into lib/validate.ts)

Pre-validate input BEFORE handing off to bwip-js. bwip-js throws cryptic errors on bad input. Specific rules:

- **EAN-13**: exactly 12 or 13 digits (Mod 10 checksum)
- **EAN-8**: exactly 7 or 8 digits
- **UPC-A**: exactly 11 or 12 digits
- **UPC-E**: 6, 7, or 8 digits
- **Code128**: any ASCII, 1-80 chars typical
- **Code39**: uppercase A-Z, 0-9, and `-. $/+%*` only
- **ITF**: even number of digits only
- **Codabar**: 0-9 and `-$:/.+` with start/stop chars `ABCD`
- **MSI**: digits only

---

## Barcode-Specific Error Codes

Beyond platform errors:
- `UNSUPPORTED_FORMAT` (400)
- `INVALID_DATA_FOR_FORMAT` (400)
- `INVALID_CHECKSUM` (400)
- `INVALID_LENGTH` (400)
- `FILE_TOO_LARGE` (400)
- `INVALID_IMAGE` (400)
- `NO_BARCODE_FOUND` (404)
- `IMAGE_FETCH_FAILED` (400)

---

## Fallback Decoder Priority

If `rxing-wasm` has issues on Vercel:

1. Try `@deviceflow/rxing-wasm` (community fork, same API, 739 downloads/month)
2. Fall back to `@zxing/library` only as last resort — requires manual `RGBLuminanceSource` construction from sharp pixel output
3. Escalate to Opus for a new library choice before spending >2 hours on library debugging
