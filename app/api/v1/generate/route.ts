import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { successResponse, errorResponse, generateRequestId } from '@/lib/response'
import { generateBarcode, GenerateOptions } from '@/lib/barcode'
import { validateBarcodeData } from '@/lib/validate'
import { BARCODE_FORMATS, OUTPUT_FORMATS, ROTATIONS, BARCODE_LIMITS, BarcodeFormat, ErrorCode, Rotation, OutputFormat } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('INVALID_PARAMS', 'Request body must be valid JSON', 400, { request_id: requestId })
    }

    const {
      data,
      format,
      output_format = 'png',
      width = 2,
      height = 50,
      include_text = true,
      text_size = 10,
      background_color = '#FFFFFF',
      bar_color = '#000000',
      text_color = '#000000',
      rotation = 0,
      margin = 10
    } = body

    // Validate required parameters
    if (typeof data !== 'string') {
      return errorResponse('INVALID_PARAMS', 'Parameter "data" must be a string', 400, { request_id: requestId })
    }

    if (typeof format !== 'string' || !BARCODE_FORMATS.includes(format as any)) {
      return errorResponse('UNSUPPORTED_FORMAT', `Parameter "format" must be one of: ${BARCODE_FORMATS.join(', ')}`, 400, { request_id: requestId })
    }

    if (!OUTPUT_FORMATS.includes(output_format as any)) {
      return errorResponse('INVALID_PARAMS', `Parameter "output_format" must be one of: ${OUTPUT_FORMATS.join(', ')}`, 400, { request_id: requestId })
    }

    if (!ROTATIONS.includes(rotation as any)) {
      return errorResponse('INVALID_PARAMS', `Parameter "rotation" must be one of: ${ROTATIONS.join(', ')}`, 400, { request_id: requestId })
    }

    // Validate dimensions
    if (typeof width !== 'number' || width < BARCODE_LIMITS.width.min || width > BARCODE_LIMITS.width.max) {
      return errorResponse('INVALID_PARAMS', `Parameter "width" must be between ${BARCODE_LIMITS.width.min} and ${BARCODE_LIMITS.width.max}`, 400, { request_id: requestId })
    }

    if (typeof height !== 'number' || height < BARCODE_LIMITS.height.min || height > BARCODE_LIMITS.height.max) {
      return errorResponse('INVALID_PARAMS', `Parameter "height" must be between ${BARCODE_LIMITS.height.min} and ${BARCODE_LIMITS.height.max}`, 400, { request_id: requestId })
    }

    if (typeof text_size !== 'number' || text_size < BARCODE_LIMITS.text_size.min || text_size > BARCODE_LIMITS.text_size.max) {
      return errorResponse('INVALID_PARAMS', `Parameter "text_size" must be between ${BARCODE_LIMITS.text_size.min} and ${BARCODE_LIMITS.text_size.max}`, 400, { request_id: requestId })
    }

    if (typeof margin !== 'number' || margin < BARCODE_LIMITS.margin.min || margin > BARCODE_LIMITS.margin.max) {
      return errorResponse('INVALID_PARAMS', `Parameter "margin" must be between ${BARCODE_LIMITS.margin.min} and ${BARCODE_LIMITS.margin.max}`, 400, { request_id: requestId })
    }

    // Validate zero dimensions
    if (width === 0 || height === 0) {
      return errorResponse('INVALID_PARAMS', 'Width and height must be greater than zero', 400, { request_id: requestId })
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

    // Validate barcode data for the format
    const validationResult = validateBarcodeData(data, format as BarcodeFormat)
    if (!validationResult.valid) {
      // Map validation errors to appropriate error codes
      const errorMessage = validationResult.errors.join('; ')

      if (validationResult.errors.some(err => err.includes('length') || err.includes('digits'))) {
        return errorResponse('INVALID_LENGTH', errorMessage, 400, { request_id: requestId })
      }

      if (validationResult.errors.some(err => err.includes('checksum'))) {
        return errorResponse('INVALID_CHECKSUM', errorMessage, 400, { request_id: requestId })
      }

      return errorResponse('INVALID_DATA_FOR_FORMAT', errorMessage, 400, { request_id: requestId })
    }

    // Prepare generation options
    const options = {
      data,
      format,
      output_format,
      width,
      height,
      include_text,
      text_size,
      background_color,
      bar_color,
      text_color,
      rotation,
      margin
    } as GenerateOptions

    // Generate barcode
    const result = await generateBarcode(options)

    // Calculate processing time and prepare response
    const processingMs = Date.now() - startTime

    return successResponse(result, {
      request_id: requestId,
      processing_ms: processingMs,
      remaining_credits: rateLimitResult.remaining - 1
    })

  } catch (error: any) {
    console.error('Generation error:', error)
    const processingMs = Date.now() - startTime

    let errorMessage = 'Internal server error during generation'
    let errorCode: ErrorCode = 'PROCESSING_FAILED'

    // Handle specific error cases
    if (error.message.includes('bwip-js library not available')) {
      errorCode = 'PROCESSING_FAILED'
      errorMessage = 'Barcode generation service temporarily unavailable'
    } else if (error.message.includes('PDF output does not support transparent backgrounds')) {
      errorCode = 'INVALID_PARAMS'
      errorMessage = 'PDF output format does not support transparent backgrounds'
    }

    return errorResponse(errorCode, errorMessage, 500, {
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