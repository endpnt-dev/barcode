import { NextResponse } from 'next/server'
import { ErrorCode } from './config'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: ErrorCode
    message: string
  }
  meta?: {
    request_id?: string
    processing_ms?: number
    remaining_credits?: number
  }
}

export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    },
    { status }
  )
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
  meta?: ApiResponse['meta']
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
      meta,
    },
    { status }
  )
}

export function generateRequestId(): string {
  return `req_${Math.random().toString(36).substr(2, 8)}`
}

export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    AUTH_REQUIRED: 'API key is required. Include x-api-key header.',
    INVALID_API_KEY: 'Invalid API key. Check your credentials.',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
    UNSUPPORTED_FORMAT: 'Unsupported barcode format. Check supported formats.',
    INVALID_DATA_FOR_FORMAT: 'Invalid data for this barcode format.',
    INVALID_CHECKSUM: 'Invalid checksum for this barcode format.',
    INVALID_LENGTH: 'Invalid data length for this barcode format.',
    FILE_TOO_LARGE: 'File too large. Maximum size is 10MB.',
    INVALID_IMAGE: 'Invalid or corrupted image file.',
    NO_BARCODE_FOUND: 'No barcode found in the image.',
    IMAGE_FETCH_FAILED: 'Failed to fetch image from URL.',
    INVALID_PARAMS: 'Invalid parameters. Check the request format.',
    PROCESSING_FAILED: 'Failed to process barcode. Please try again.',
    INTERNAL_ERROR: 'Internal server error. Please try again later.',
  }
  return messages[code]
}