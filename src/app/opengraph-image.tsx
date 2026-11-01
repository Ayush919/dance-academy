import { ImageResponse } from 'next/og'

export const alt = 'Remo Dance Company — dance classes in Mumbai & Pune'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Default social share card in the Stage style. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: 'radial-gradient(70% 90% at 20% 0%, #7a2618 0%, #0B0B0C 60%)',
        color: '#F5F2EC',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: 8, color: '#FF4A2B', textTransform: 'uppercase' }}>
        Remo Dance Company
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 112,
          fontWeight: 900,
          lineHeight: 0.95,
          textTransform: 'uppercase',
          letterSpacing: -2,
        }}
      >
        <span>Move like</span>
        <span>the stage</span>
        <span
          style={{ color: '#FF4A2B', fontStyle: 'italic', textTransform: 'none', fontWeight: 400 }}
        >
          is yours.
        </span>
      </div>
      <div style={{ fontSize: 28, color: '#C9C5BE' }}>
        Hip-hop · Bollywood · Contemporary · Jazz · Mumbai & Pune
      </div>
    </div>,
    size,
  )
}
