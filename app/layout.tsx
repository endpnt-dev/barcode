import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barcode API - Generate and decode barcodes with one API call',
  description: 'Fast, reliable barcode generation and decoding API supporting 9 1D formats: EAN-13, UPC-A, Code 128, Code 39, ITF, Codabar, MSI, EAN-8, UPC-E. Perfect for automation and integration.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}