import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(45deg, #10b981, #059669)',
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          {/* Barcode style pattern - vertical lines of varying widths */}
          <rect x="2" y="4" width="1" height="16" />
          <rect x="4" y="4" width="2" height="16" />
          <rect x="7" y="4" width="1" height="16" />
          <rect x="9" y="4" width="1" height="16" />
          <rect x="11" y="4" width="3" height="16" />
          <rect x="15" y="4" width="1" height="16" />
          <rect x="17" y="4" width="2" height="16" />
          <rect x="20" y="4" width="1" height="16" />
          <rect x="22" y="4" width="1" height="16" />
        </svg>
      </div>
    ),
    { ...size }
  )
}