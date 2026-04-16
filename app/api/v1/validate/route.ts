import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { successResponse, errorResponse } from '@/lib/response'
import { validateBarcodeData } from '@/lib/validate'
import { BARCODE_FORMATS, BarcodeFormat } from '@/lib/config'
import { generateRequestId } from '@/lib/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('INVALID_PARAMS', 'Request body must be valid JSON', 400, { request_id: requestId })
    }

    const { data, format } = body

    // Validate required parameters
    if (typeof data !== 'string') {
      return errorResponse('INVALID_PARAMS', 'Parameter "data" must be a string', 400, { request_id: requestId })
    }

    if (typeof format !== 'string' || !BARCODE_FORMATS.includes(format as any)) {
      return errorResponse('UNSUPPORTED_FORMAT', `Parameter "format" must be one of: ${BARCODE_FORMATS.join(', ')}`, 400, { request_id: requestId })
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

    // Validate barcode data
    const validationResult = validateBarcodeData(data, format as BarcodeFormat)

    // Prepare response
    const processingMs = Date.now() - startTime

    return successResponse({
      valid: validationResult.valid,
      format: validationResult.format,
      checksum_valid: validationResult.checksum_valid,
      checksum_digit: validationResult.checksum_digit,
      errors: validationResult.errors
    }, {
      request_id: requestId,
      processing_ms: processingMs,
      remaining_credits: rateLimitResult.remaining
    })

  } catch (error: any) {
    console.error('Validation error:', error)
    const processingMs = Date.now() - startTime

    return errorResponse('INTERNAL_ERROR', 'Internal server error during validation', 500, {
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