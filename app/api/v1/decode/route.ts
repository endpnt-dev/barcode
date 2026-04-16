import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { successResponse, errorResponse, generateRequestId } from '@/lib/response'
import { decodeBarcodes, DecodeInput, DecodeOptions } from '@/lib/decode'
import { BARCODE_FORMATS, BARCODE_LIMITS, ErrorCode } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    const contentType = request.headers.get('content-type') || ''

    let body: any
    let decodeInput: DecodeInput = {}

    // Handle different content types
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (file upload)
      const formData = await request.formData()

      const imageFile = formData.get('image') as File | null
      if (!imageFile) {
        return errorResponse('INVALID_PARAMS', 'File parameter "image" is required for multipart requests', 400, { request_id: requestId })
      }

      if (imageFile.size > BARCODE_LIMITS.decode_max_bytes) {
        return errorResponse('FILE_TOO_LARGE', `File too large. Maximum size is ${Math.round(BARCODE_LIMITS.decode_max_bytes / 1024 / 1024)}MB`, 400, { request_id: requestId })
      }

      // Convert file to buffer
      const arrayBuffer = await imageFile.arrayBuffer()
      decodeInput.buffer = Buffer.from(arrayBuffer)

      // Extract other form fields
      body = {
        format_hint: formData.get('format_hint')?.toString(),
        multi: formData.get('multi')?.toString() === 'true' || formData.get('multi')?.toString() === '1'
      }

    } else if (contentType.includes('application/json')) {
      // Handle JSON with image_url
      body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return errorResponse('INVALID_PARAMS', 'Request body must be valid JSON', 400, { request_id: requestId })
      }

      if (!body.image_url) {
        return errorResponse('INVALID_PARAMS', 'Parameter "image_url" is required for JSON requests', 400, { request_id: requestId })
      }

      decodeInput.url = body.image_url

    } else {
      return errorResponse('INVALID_PARAMS', 'Content-Type must be either multipart/form-data or application/json', 400, { request_id: requestId })
    }

    // Ensure exactly one input method
    if (!decodeInput.buffer && !decodeInput.url) {
      return errorResponse('INVALID_PARAMS', 'Either "image" file or "image_url" must be provided', 400, { request_id: requestId })
    }

    // Parse decode options
    const options: DecodeOptions = {
      multi: Boolean(body.multi),
      formatHint: body.format_hint
    }

    // Validate format_hint if provided
    if (options.formatHint && !BARCODE_FORMATS.includes(options.formatHint as any)) {
      return errorResponse('UNSUPPORTED_FORMAT', `Parameter "format_hint" must be one of: ${BARCODE_FORMATS.join(', ')}`, 400, { request_id: requestId })
    }

    // Authenticate API key
    const authResult = validateApiKey(request)
    if (!authResult.valid) {
      return errorResponse('INVALID_API_KEY', authResult.message, 401, { request_id: requestId })
    }

    if (!authResult.apiKey) {
      return errorResponse('AUTH_REQUIRED', 'API key required in x-api-key header', 401, { request_id: requestId })
    }

    // Check rate limit
    const apiKeyString = getApiKeyFromHeaders(request.headers)!
    const tier = authResult.apiKey.tier
    const rateLimitResult = await checkRateLimit(apiKeyString, tier)

    if (!rateLimitResult.allowed) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Please upgrade your plan or try again later.', 429, {
        request_id: requestId,
        remaining_credits: rateLimitResult.remaining
      })
    }

    // Perform barcode decoding
    const detections = await decodeBarcodes(decodeInput, options)

    // Prepare response
    const processingMs = Date.now() - startTime

    return successResponse({
      detections,
      total_detected: detections.length
    }, {
      request_id: requestId,
      processing_ms: processingMs,
      remaining_credits: rateLimitResult.remaining - 1
    })

  } catch (error: any) {
    console.error('Decode error:', error)
    const processingMs = Date.now() - startTime

    // Map specific errors to appropriate error codes
    let errorCode: ErrorCode = 'PROCESSING_FAILED'
    let errorMessage = 'Internal server error during decoding'
    let status = 500

    if (error.message === 'FILE_TOO_LARGE') {
      errorCode = 'FILE_TOO_LARGE'
      errorMessage = `File too large. Maximum size is ${Math.round(BARCODE_LIMITS.decode_max_bytes / 1024 / 1024)}MB`
      status = 400
    } else if (error.message.startsWith('INVALID_IMAGE')) {
      errorCode = 'INVALID_IMAGE'
      errorMessage = error.message.replace('INVALID_IMAGE: ', '')
      status = 400
    } else if (error.message === 'NO_BARCODE_FOUND') {
      errorCode = 'NO_BARCODE_FOUND'
      errorMessage = 'No barcode found in the image'
      status = 404
    } else if (error.message.startsWith('IMAGE_FETCH_FAILED')) {
      errorCode = 'IMAGE_FETCH_FAILED'
      errorMessage = error.message.replace('IMAGE_FETCH_FAILED: ', '')
      status = 400
    } else if (error.message.includes('sharp library not available') ||
               error.message.includes('rxing-wasm library not available')) {
      errorCode = 'PROCESSING_FAILED'
      errorMessage = 'Barcode decoding service temporarily unavailable'
      status = 500
    }

    return errorResponse(errorCode, errorMessage, status, {
      request_id: requestId,
      processing_ms: processingMs
    })
  }
}

// Handle unsupported methods
export async function GET() {
  const requestId = generateRequestId()
  return errorResponse('INVALID_PARAMS', 'Method not allowed. Use POST.', 405, { request_id: requestId })
}

export async function PUT() {
  const requestId = generateRequestId()
  return errorResponse('INVALID_PARAMS', 'Method not allowed. Use POST.', 405, { request_id: requestId })
}

export async function DELETE() {
  const requestId = generateRequestId()
  return errorResponse('INVALID_PARAMS', 'Method not allowed. Use POST.', 405, { request_id: requestId })
}