export const API_VERSION = '1.0.0'
export const SERVICE_NAME = 'barcode'

export const TIER_LIMITS = {
  free: {
    requests_per_minute: 10,
    requests_per_month: 100
  },
  starter: {
    requests_per_minute: 60,
    requests_per_month: 10000
  },
  pro: {
    requests_per_minute: 300,
    requests_per_month: 100000
  },
  enterprise: {
    requests_per_minute: 1000,
    requests_per_month: 1000000
  },
} as const

export const BARCODE_FORMATS = [
  'code128', 'ean13', 'ean8', 'upca', 'upce', 'code39',
  'itf', 'codabar', 'msi'
] as const

export const OUTPUT_FORMATS = ['png', 'svg', 'pdf'] as const
export const ROTATIONS = [0, 90, 180, 270] as const

export const BARCODE_DEFAULTS = {
  output_format: 'png',
  width: 2,
  height: 50,
  include_text: true,
  text_size: 10,
  background_color: '#FFFFFF',
  bar_color: '#000000',
  text_color: '#000000',
  rotation: 0,
  margin: 10,
} as const

export const BARCODE_LIMITS = {
  width: { min: 1, max: 10 },
  height: { min: 10, max: 500 },
  text_size: { min: 6, max: 48 },
  margin: { min: 0, max: 100 },
  decode_max_bytes: 10 * 1024 * 1024,
  fetch_timeout_ms: 5000,
}

export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_PARAMS: 'INVALID_PARAMS',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  INVALID_DATA_FOR_FORMAT: 'INVALID_DATA_FOR_FORMAT',
  INVALID_CHECKSUM: 'INVALID_CHECKSUM',
  INVALID_LENGTH: 'INVALID_LENGTH',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_IMAGE: 'INVALID_IMAGE',
  NO_BARCODE_FOUND: 'NO_BARCODE_FOUND',
  IMAGE_FETCH_FAILED: 'IMAGE_FETCH_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type BarcodeFormat = typeof BARCODE_FORMATS[number]
export type OutputFormat = typeof OUTPUT_FORMATS[number]
export type Rotation = typeof ROTATIONS[number]
export type ApiTier = keyof typeof TIER_LIMITS
export type ErrorCode = keyof typeof ERROR_CODES