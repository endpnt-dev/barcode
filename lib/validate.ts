import { BARCODE_FORMATS } from './config'

export type BarcodeFormat = typeof BARCODE_FORMATS[number]

export interface ValidationResult {
  valid: boolean
  format: BarcodeFormat
  checksum_valid: boolean
  checksum_digit?: number
  errors: string[]
}

/**
 * Validates barcode data for the specified format
 */
export function validateBarcodeData(data: string, format: BarcodeFormat): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    format,
    checksum_valid: true,
    errors: []
  }

  switch (format) {
    case 'ean13':
      return validateEAN13(data, result)
    case 'ean8':
      return validateEAN8(data, result)
    case 'upca':
      return validateUPCA(data, result)
    case 'upce':
      return validateUPCE(data, result)
    case 'code128':
      return validateCode128(data, result)
    case 'code39':
      return validateCode39(data, result)
    case 'itf':
      return validateITF(data, result)
    case 'codabar':
      return validateCodabar(data, result)
    case 'msi':
      return validateMSI(data, result)
    default:
      result.valid = false
      result.errors.push(`Unsupported format: ${format}`)
      return result
  }
}

function validateEAN13(data: string, result: ValidationResult): ValidationResult {
  // EAN-13: 12 digits (13th is checksum) or 13 digits (checksum validated)
  if (!/^\d{12,13}$/.test(data)) {
    result.valid = false
    result.checksum_valid = false
    result.errors.push('EAN-13 requires 12 or 13 digits; received ' + data.length)
    return result
  }

  if (data.length === 12) {
    // Calculate checksum
    const checksum = calculateEAN13Checksum(data)
    result.checksum_digit = checksum
    return result
  }

  if (data.length === 13) {
    // Validate existing checksum
    const providedChecksum = parseInt(data[12])
    const calculatedChecksum = calculateEAN13Checksum(data.slice(0, 12))

    if (providedChecksum !== calculatedChecksum) {
      result.valid = false
      result.checksum_valid = false
      result.errors.push(`Invalid EAN-13 checksum: expected ${calculatedChecksum}, got ${providedChecksum}`)
    }
    result.checksum_digit = calculatedChecksum
  }

  return result
}

function validateEAN8(data: string, result: ValidationResult): ValidationResult {
  // EAN-8: 7 digits (8th is checksum) or 8 digits
  if (!/^\d{7,8}$/.test(data)) {
    result.valid = false
    result.checksum_valid = false
    result.errors.push('EAN-8 requires 7 or 8 digits; received ' + data.length)
    return result
  }

  if (data.length === 7) {
    const checksum = calculateEAN8Checksum(data)
    result.checksum_digit = checksum
    return result
  }

  if (data.length === 8) {
    const providedChecksum = parseInt(data[7])
    const calculatedChecksum = calculateEAN8Checksum(data.slice(0, 7))

    if (providedChecksum !== calculatedChecksum) {
      result.valid = false
      result.checksum_valid = false
      result.errors.push(`Invalid EAN-8 checksum: expected ${calculatedChecksum}, got ${providedChecksum}`)
    }
    result.checksum_digit = calculatedChecksum
  }

  return result
}

function validateUPCA(data: string, result: ValidationResult): ValidationResult {
  // UPC-A: 11 digits (12th is checksum) or 12 digits
  if (!/^\d{11,12}$/.test(data)) {
    result.valid = false
    result.checksum_valid = false
    result.errors.push('UPC-A requires 11 or 12 digits; received ' + data.length)
    return result
  }

  if (data.length === 11) {
    const checksum = calculateUPCAChecksum(data)
    result.checksum_digit = checksum
    return result
  }

  if (data.length === 12) {
    const providedChecksum = parseInt(data[11])
    const calculatedChecksum = calculateUPCAChecksum(data.slice(0, 11))

    if (providedChecksum !== calculatedChecksum) {
      result.valid = false
      result.checksum_valid = false
      result.errors.push(`Invalid UPC-A checksum: expected ${calculatedChecksum}, got ${providedChecksum}`)
    }
    result.checksum_digit = calculatedChecksum
  }

  return result
}

function validateUPCE(data: string, result: ValidationResult): ValidationResult {
  // UPC-E: 6, 7, or 8 digits
  if (!/^\d{6,8}$/.test(data)) {
    result.valid = false
    result.errors.push('UPC-E requires 6, 7, or 8 digits; received ' + data.length)
    return result
  }

  // UPC-E expansion and validation is complex; defer to bwip-js for now
  return result
}

function validateCode128(data: string, result: ValidationResult): ValidationResult {
  // Code128: any ASCII characters, 1-200 chars
  if (data.length === 0) {
    result.valid = false
    result.errors.push('Code128 requires at least 1 character')
    return result
  }

  if (data.length > 200) {
    result.valid = false
    result.errors.push('Code128 data too long: maximum 200 characters; received ' + data.length)
    return result
  }

  // Check for ASCII characters only
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i)
    if (charCode > 127) {
      result.valid = false
      result.errors.push('Code128 only supports ASCII characters')
      break
    }
  }

  return result
}

function validateCode39(data: string, result: ValidationResult): ValidationResult {
  // Code39: uppercase A-Z, 0-9, and -. $/+%* only
  if (!/^[A-Z0-9\-. $/+%*]+$/.test(data)) {
    result.valid = false
    result.errors.push('Code39 only supports uppercase A-Z, 0-9, and characters: -. $/+%*')
    return result
  }

  return result
}

function validateITF(data: string, result: ValidationResult): ValidationResult {
  // ITF: even number of digits only
  if (!/^\d+$/.test(data)) {
    result.valid = false
    result.errors.push('ITF (Interleaved 2 of 5) only supports digits')
    return result
  }

  if (data.length % 2 !== 0) {
    result.valid = false
    result.errors.push('ITF (Interleaved 2 of 5) requires even number of digits; received ' + data.length)
    return result
  }

  return result
}

function validateCodabar(data: string, result: ValidationResult): ValidationResult {
  // Codabar: 0-9 and -$:/.+ with start/stop chars ABCD
  if (!/^[ABCD][0-9\-$:/.+]*[ABCD]$/.test(data)) {
    result.valid = false
    result.errors.push('Codabar must start and end with A, B, C, or D, and contain only 0-9 and -$:/.+ in between')
    return result
  }

  return result
}

function validateMSI(data: string, result: ValidationResult): ValidationResult {
  // MSI: digits only, variable length
  if (!/^\d+$/.test(data)) {
    result.valid = false
    result.errors.push('MSI only supports digits')
    return result
  }

  if (data.length === 0) {
    result.valid = false
    result.errors.push('MSI requires at least 1 digit')
    return result
  }

  return result
}

/**
 * Calculate EAN-13 checksum using Mod 10 algorithm
 */
function calculateEAN13Checksum(data: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(data[i])
    // EAN-13 weights: odd positions (1,3,5...) weight 1, even positions (2,4,6...) weight 3
    const weight = i % 2 === 0 ? 1 : 3
    sum += digit * weight
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/**
 * Calculate EAN-8 checksum using Mod 10 algorithm
 */
function calculateEAN8Checksum(data: string): number {
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(data[i])
    // EAN-8 weights: odd positions weight 3, even positions weight 1 (opposite of EAN-13)
    const weight = i % 2 === 0 ? 3 : 1
    sum += digit * weight
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/**
 * Calculate UPC-A checksum using Mod 10 algorithm
 */
function calculateUPCAChecksum(data: string): number {
  let sum = 0
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(data[i])
    // UPC-A weights: odd positions (1,3,5...) weight 3, even positions (2,4,6...) weight 1
    const weight = i % 2 === 0 ? 3 : 1
    sum += digit * weight
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}