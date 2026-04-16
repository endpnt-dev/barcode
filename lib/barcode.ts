import { OutputFormat, BarcodeFormat, Rotation, BARCODE_DEFAULTS } from './config'

export interface GenerateOptions {
  data: string
  format: BarcodeFormat
  output_format?: OutputFormat
  width?: number
  height?: number
  include_text?: boolean
  text_size?: number
  background_color?: string
  bar_color?: string
  text_color?: string
  rotation?: Rotation
  margin?: number
}

export interface GenerateResult {
  image: string
  output_format: OutputFormat
  barcode_format: BarcodeFormat
  data_encoded: string
  width: number
  height: number
  file_size_bytes: number
}

/**
 * Map spec format names to bwip-js bcid values
 */
const BCID_MAPPING: Record<BarcodeFormat, string> = {
  'code128': 'code128',
  'ean13': 'ean13',
  'ean8': 'ean8',
  'upca': 'upca',
  'upce': 'upce',
  'code39': 'code39',
  'itf': 'interleaved2of5',  // Note: ITF uses interleaved2of5 in bwip-js
  'codabar': 'rationalizedCodabar',
  'msi': 'msi'
}

/**
 * Map rotation degrees to bwip-js rotation values
 */
const ROTATION_MAPPING: Record<Rotation, string> = {
  0: 'N',    // North (normal)
  90: 'R',   // Right (90 degrees clockwise)
  180: 'I',  // Inverted (180 degrees)
  270: 'L'   // Left (270 degrees clockwise / 90 counter-clockwise)
}

/**
 * Generate a barcode with the specified options
 */
export async function generateBarcode(options: GenerateOptions): Promise<GenerateResult> {
  // Apply defaults
  const opts = {
    ...BARCODE_DEFAULTS,
    ...options
  }

  // Validate PDF background transparency (edge case 11)
  if (opts.output_format === 'pdf' && (opts.background_color === 'transparent' || opts.background_color.includes('rgba'))) {
    throw new Error('PDF output does not support transparent backgrounds')
  }

  // Generate based on output format
  switch (opts.output_format) {
    case 'png':
      return await renderPNG(opts)
    case 'svg':
      return await renderSVG(opts)
    case 'pdf':
      return await renderPDF(opts)
    default:
      throw new Error(`Unsupported output format: ${opts.output_format}`)
  }
}

async function renderPNG(opts: GenerateOptions): Promise<GenerateResult> {
  // Dynamic import to handle potential missing dependency during build
  let bwipjs: any
  try {
    bwipjs = await import('bwip-js')
  } catch (error) {
    throw new Error('bwip-js library not available')
  }

  const bcid = BCID_MAPPING[opts.format!]
  const rotation = ROTATION_MAPPING[opts.rotation || 0]

  // Strip # from color values if present
  const backgroundColor = opts.background_color?.replace('#', '') || 'FFFFFF'
  const barColor = opts.bar_color?.replace('#', '') || '000000'
  const textColor = opts.text_color?.replace('#', '') || '000000'

  try {
    const buffer = await bwipjs.toBuffer({
      bcid,
      text: opts.data,
      scale: opts.width || 2,
      height: opts.height || 50,
      includetext: opts.include_text !== false,
      textsize: opts.text_size || 10,
      backgroundcolor: backgroundColor,
      barcolor: barColor,
      textcolor: textColor,
      rotate: rotation,
      paddingleft: opts.margin || 10,
      paddingright: opts.margin || 10,
      paddingtop: opts.margin || 10,
      paddingbottom: opts.margin || 10,
    })

    return {
      image: buffer.toString('base64'),
      output_format: 'png',
      barcode_format: opts.format!,
      data_encoded: opts.data!,
      width: buffer.length > 0 ? (opts.width || 2) * 50 : 0,  // Approximate width calculation
      height: opts.height || 50,
      file_size_bytes: buffer.length
    }
  } catch (error: any) {
    throw new Error(`Barcode generation failed: ${error.message}`)
  }
}

async function renderSVG(opts: GenerateOptions): Promise<GenerateResult> {
  let bwipjs: any
  try {
    bwipjs = await import('bwip-js')
  } catch (error) {
    throw new Error('bwip-js library not available')
  }

  const bcid = BCID_MAPPING[opts.format!]
  const rotation = ROTATION_MAPPING[opts.rotation || 0]

  const backgroundColor = opts.background_color?.replace('#', '') || 'FFFFFF'
  const barColor = opts.bar_color?.replace('#', '') || '000000'
  const textColor = opts.text_color?.replace('#', '') || '000000'

  try {
    const svg = await bwipjs.toSVG({
      bcid,
      text: opts.data,
      scale: opts.width || 2,
      height: opts.height || 50,
      includetext: opts.include_text !== false,
      textsize: opts.text_size || 10,
      backgroundcolor: backgroundColor,
      barcolor: barColor,
      textcolor: textColor,
      rotate: rotation,
      paddingleft: opts.margin || 10,
      paddingright: opts.margin || 10,
      paddingtop: opts.margin || 10,
      paddingbottom: opts.margin || 10,
    })

    return {
      image: Buffer.from(svg, 'utf8').toString('base64'),
      output_format: 'svg',
      barcode_format: opts.format!,
      data_encoded: opts.data!,
      width: (opts.width || 2) * 50,
      height: opts.height || 50,
      file_size_bytes: Buffer.byteLength(svg, 'utf8')
    }
  } catch (error: any) {
    throw new Error(`SVG generation failed: ${error.message}`)
  }
}

async function renderPDF(opts: GenerateOptions): Promise<GenerateResult> {
  // First generate PNG
  const pngResult = await renderPNG(opts)

  let pdfLib: any
  try {
    pdfLib = await import('pdf-lib')
  } catch (error) {
    throw new Error('pdf-lib library not available')
  }

  const { PDFDocument } = pdfLib

  try {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()

    // Decode the base64 PNG data
    const pngImageBytes = Buffer.from(pngResult.image, 'base64')
    const pngImage = await pdfDoc.embedPng(pngImageBytes)

    // Calculate dimensions
    const pngDims = pngImage.scale(1)
    const margin = opts.margin || 10

    // Set page size to fit the barcode plus margin
    page.setSize(pngDims.width + (margin * 2), pngDims.height + (margin * 2))

    // Draw the barcode centered on the page
    page.drawImage(pngImage, {
      x: margin,
      y: margin,
      width: pngDims.width,
      height: pngDims.height,
    })

    const pdfBytes = await pdfDoc.save()

    return {
      image: Buffer.from(pdfBytes).toString('base64'),
      output_format: 'pdf',
      barcode_format: opts.format!,
      data_encoded: opts.data!,
      width: pngDims.width + (margin * 2),
      height: pngDims.height + (margin * 2),
      file_size_bytes: pdfBytes.byteLength
    }
  } catch (error: any) {
    throw new Error(`PDF generation failed: ${error.message}`)
  }
}