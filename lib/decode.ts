import { BarcodeFormat, BARCODE_LIMITS } from './config'

export interface DecodeOptions {
  multi?: boolean
  formatHint?: BarcodeFormat
}

export interface Detection {
  data: string
  format: BarcodeFormat
  confidence: number
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface DecodeInput {
  buffer?: Buffer
  url?: string
}

/**
 * Map rxing-wasm format values back to spec format names
 */
const FORMAT_MAPPING: Record<string, BarcodeFormat> = {
  'EAN_13': 'ean13',
  'EAN_8': 'ean8',
  'UPC_A': 'upca',
  'UPC_E': 'upce',
  'CODE_128': 'code128',
  'CODE_39': 'code39',
  'ITF': 'itf',
  'CODABAR': 'codabar',
  'MSI': 'msi'
}

/**
 * Decode barcodes from an image buffer or URL
 */
export async function decodeBarcodes(input: DecodeInput, options: DecodeOptions = {}): Promise<Detection[]> {
  let imageBuffer: Buffer

  // Resolve input to Buffer
  if (input.buffer) {
    imageBuffer = input.buffer
  } else if (input.url) {
    imageBuffer = await fetchImageFromUrl(input.url)
  } else {
    throw new Error('Either buffer or url must be provided')
  }

  // Size check
  if (imageBuffer.byteLength > BARCODE_LIMITS.decode_max_bytes) {
    throw new Error('FILE_TOO_LARGE')
  }

  // Decode image to raw pixels using sharp
  const { pixelData, width, height } = await decodeImageToPixels(imageBuffer)

  // Use rxing-wasm to detect barcodes
  const detections = await detectBarcodesWithRxing(pixelData, width, height, options)

  return detections
}

async function fetchImageFromUrl(url: string): Promise<Buffer> {
  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BARCODE_LIMITS.fetch_timeout_ms)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'endpnt-barcode-api/1.0'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Check content-length header
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > BARCODE_LIMITS.decode_max_bytes) {
      throw new Error('FILE_TOO_LARGE')
    }

    const buffer = await response.arrayBuffer()

    if (buffer.byteLength > BARCODE_LIMITS.decode_max_bytes) {
      throw new Error('FILE_TOO_LARGE')
    }

    return Buffer.from(buffer)

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('IMAGE_FETCH_FAILED: Request timeout')
    }
    if (error.message === 'FILE_TOO_LARGE') {
      throw error
    }
    throw new Error(`IMAGE_FETCH_FAILED: ${error.message}`)
  }
}

async function decodeImageToPixels(imageBuffer: Buffer): Promise<{ pixelData: Uint8Array, width: number, height: number }> {
  let sharp: any
  try {
    sharp = (await import('sharp')).default
  } catch (error) {
    throw new Error('INVALID_IMAGE: Sharp library not available')
  }

  try {
    // Verify this is a valid image
    const metadata = await sharp(imageBuffer).metadata()
    if (!metadata.width || !metadata.height) {
      throw new Error('INVALID_IMAGE: Cannot determine image dimensions')
    }

    // Decode to raw RGBA pixels (rxing-wasm typically expects RGBA)
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()  // Force RGBA format
      .raw()
      .toBuffer({ resolveWithObject: true })

    return {
      pixelData: new Uint8Array(data),
      width: info.width,
      height: info.height
    }

  } catch (error: any) {
    if (error.message.includes('Input file contains unsupported image format') ||
        error.message.includes('Input buffer contains unsupported image format')) {
      throw new Error('INVALID_IMAGE: Unsupported image format')
    }
    throw new Error(`INVALID_IMAGE: ${error.message}`)
  }
}

async function detectBarcodesWithRxing(
  pixelData: Uint8Array,
  width: number,
  height: number,
  options: DecodeOptions
): Promise<Detection[]> {
  let rxing: any
  try {
    rxing = await import('rxing-wasm')
  } catch (error) {
    throw new Error('rxing-wasm library not available')
  }

  try {
    // Build hints object if format hint provided
    const hints: any = {}
    if (options.formatHint) {
      // Map spec format to rxing format enum
      const rxingFormat = Object.keys(FORMAT_MAPPING).find(
        key => FORMAT_MAPPING[key] === options.formatHint
      )
      if (rxingFormat) {
        hints.possibleFormats = [rxingFormat]
      }
    }

    // Call appropriate rxing function based on multi option
    let results: any[]
    if (options.multi) {
      // Try multi-decode function (verify exact function name from .d.ts)
      if (typeof rxing.decode_multi === 'function') {
        results = rxing.decode_multi(pixelData, width, height, hints)
      } else if (typeof rxing.decodeMulti === 'function') {
        results = rxing.decodeMulti(pixelData, width, height, hints)
      } else {
        // Fallback: call single decode in a loop or use available multi function
        const singleResult = rxing.decode_barcode ? rxing.decode_barcode(pixelData, width, height, hints) :
                            rxing.decode ? rxing.decode(pixelData, width, height, hints) : null
        results = singleResult ? [singleResult] : []
      }
    } else {
      // Single decode
      const singleResult = rxing.decode_barcode ? rxing.decode_barcode(pixelData, width, height, hints) :
                          rxing.decode ? rxing.decode(pixelData, width, height, hints) : null
      results = singleResult ? [singleResult] : []
    }

    if (!results || results.length === 0) {
      throw new Error('NO_BARCODE_FOUND')
    }

    // Convert rxing results to our Detection format
    const detections: Detection[] = results.map((result: any) => {
      // Map format back to spec format
      const specFormat = FORMAT_MAPPING[result.format] || 'code128'

      // Calculate position from result points (if available)
      let position = { x: 0, y: 0, width: width, height: height }
      if (result.points && result.points.length > 0) {
        const xs = result.points.map((p: any) => p.x || 0)
        const ys = result.points.map((p: any) => p.y || 0)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)

        position = {
          x: Math.max(0, Math.floor(minX)),
          y: Math.max(0, Math.floor(minY)),
          width: Math.max(1, Math.floor(maxX - minX)),
          height: Math.max(1, Math.floor(maxY - minY))
        }
      }

      return {
        data: result.text || result.data || '',
        format: specFormat,
        confidence: result.confidence || 1.0,  // rxing-wasm may not provide confidence
        position
      }
    })

    // If multi=false but we got multiple results, return only the first
    if (!options.multi && detections.length > 1) {
      return [detections[0]]
    }

    return detections

  } catch (error: any) {
    if (error.message === 'NO_BARCODE_FOUND') {
      throw error
    }
    console.error('rxing-wasm decode error:', error)
    throw new Error('NO_BARCODE_FOUND')
  }
}