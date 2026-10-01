// Vector and Image BrandMark for RESQ disaster intelligence
import React, { useState } from 'react'
import resqLogo from '../assets/resq-logo.png'
import { ShieldAlert } from 'lucide-react'

export function BrandMark({ height = 32, className, showText = false }) {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          userSelect: 'none',
        }}
        className={className}
        aria-label="resQ Brand"
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${height}px`,
            height: `${height}px`,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
          }}
        >
          <ShieldAlert size={Math.round(height * 0.65)} strokeWidth={2.4} />
        </div>
        <span
          style={{
            fontSize: `${Math.round(height * 0.65)}px`,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#0f172a',
          }}
        >
          resQ
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none',
      }}
      className={className}
      aria-label="resQ Brand"
    >
      <img
        src={resqLogo}
        alt="resQ"
        onError={() => setImgError(true)}
        style={{
          height: `${height}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
          mixBlendMode: 'multiply',
        }}
      />
      {showText && (
        <span
          style={{
            fontSize: `${Math.round(height * 0.55)}px`,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#0f172a',
          }}
        >
          resQ
        </span>
      )}
    </div>
  )
}

export default BrandMark

