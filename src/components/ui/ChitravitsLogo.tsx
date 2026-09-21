import React from 'react';

interface ChitravitsProps {
  className?: string;
  size?: number;
  variant?: 'emblem' | 'full' | 'wordmark';
}

/**
 * High-Resolution Vector Emblem of Chitravits:
 * Showcases the Earth Observation Satellite scanning the detailed map of INDIA
 * with super-resolution multispectral data cubes and camera viewfinder brackets.
 */
export function ChitravitsEmblem({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="embOrbit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B1B38" />
          <stop offset="100%" stopColor="#185294" />
        </linearGradient>
        <linearGradient id="embRay" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.4" />
        </linearGradient>
        <filter id="indiaShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0B1B38" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Background White Lens Disc with subtle bezel */}
      <circle cx="200" cy="200" r="190" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />

      {/* Camera Viewfinder Corner Brackets */}
      <path d="M 290 95 L 320 95 L 320 125" stroke="#0B1B38" strokeWidth="5.5" strokeLinecap="square" />
      <path d="M 290 285 L 320 285 L 320 255" stroke="#0B1B38" strokeWidth="5.5" strokeLinecap="square" />

      {/* Orbit / Shutter Outer Arc */}
      <path
        d="M 260 52 A 155 155 0 1 0 242 348"
        stroke="#0B1B38"
        strokeWidth="15"
        strokeLinecap="round"
      />

      {/* Scanning Satellite (Top-Left Angle) */}
      <g transform="translate(142, 98) rotate(-45)">
        {/* Bus */}
        <rect x="-16" y="-22" width="32" height="44" rx="6" fill="#0B1B38" stroke="#1E4E8C" strokeWidth="2.5" />
        {/* Sensor Dish / Lens */}
        <circle cx="0" cy="26" r="7" fill="#3B82F6" />
        <path d="M -12 26 A 12 12 0 0 1 12 26" stroke="#0B1B38" strokeWidth="3.5" fill="none" />
        
        {/* Left Solar Wing */}
        <line x1="-16" y1="0" x2="-28" y2="0" stroke="#0B1B38" strokeWidth="4" />
        <g transform="translate(-60, -18)">
          <rect x="0" y="0" width="32" height="36" rx="3" fill="#0B1B38" />
          <rect x="3" y="3" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="17" y="3" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="3" y="19" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="17" y="19" width="11" height="13" fill="#3B82F6" opacity="0.9" />
        </g>
        
        {/* Right Solar Wing */}
        <line x1="16" y1="0" x2="28" y2="0" stroke="#0B1B38" strokeWidth="4" />
        <g transform="translate(28, -18)">
          <rect x="0" y="0" width="32" height="36" rx="3" fill="#0B1B38" />
          <rect x="3" y="3" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="17" y="3" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="3" y="19" width="11" height="13" fill="#3B82F6" opacity="0.9" />
          <rect x="17" y="19" width="11" height="13" fill="#3B82F6" opacity="0.9" />
        </g>
      </g>

      {/* Laser / Radar Sensor Beams Targeting India */}
      <path d="M 160 115 L 180 175" stroke="#3B82F6" strokeWidth="2.2" strokeDasharray="5,4" />
      <path d="M 172 108 L 225 170" stroke="#00E5FF" strokeWidth="2.2" strokeDasharray="5,4" />
      <path d="M 184 100 L 268 175" stroke="#3B82F6" strokeWidth="2.2" strokeDasharray="5,4" />

      {/* Earth Globe Circle */}
      <circle cx="225" cy="225" r="82" fill="#F8FAFC" stroke="#0B1B38" strokeWidth="6" />

      {/* CLEAR, HIGH-DEFINITION MAP OF INDIA */}
      <g transform="translate(162, 158) scale(0.72)" filter="url(#indiaShadow)">
        <path
          d="
            M 80,18
            C 83,14 88,12 94,15
            C 99,18 104,15 108,21
            C 112,27 106,35 101,40
            C 105,44 114,48 112,54
            C 110,60 102,63 98,68
            C 95,73 98,80 104,83
            C 114,88 128,87 138,89
            C 146,90 158,95 166,97
            C 174,99 184,95 190,101
            C 194,106 186,114 180,117
            C 174,119 168,114 163,118
            C 158,122 160,130 153,132
            C 147,133 142,126 137,126
            C 134,131 138,138 136,144
            C 133,151 124,155 125,163
            C 126,171 131,180 126,186
            C 121,192 113,199 107,206
            C 103,211 96,218 90,222
            C 86,220 83,212 82,204
            C 80,195 73,188 71,179
            C 69,170 70,161 67,152
            C 63,142 57,137 54,127
            C 51,117 40,118 34,123
            C 28,128 20,130 14,124
            C 10,119 15,110 22,108
            C 30,105 38,103 44,97
            C 49,92 46,84 48,77
            C 50,70 57,67 61,61
            C 65,55 68,46 72,40
            C 76,33 77,24 80,18
            Z
          "
          fill="#0B1B38"
        />
        {/* Sri Lanka Island */}
        <ellipse cx="106" cy="226" rx="5" ry="7.5" transform="rotate(22 106 226)" fill="#0B1B38" />
      </g>

      {/* Super-Resolution Multispectral Data Pixels */}
      <g transform="translate(242, 160)">
        <rect x="0" y="16" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="0" y="34" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="0" y="52" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="0" y="70" width="13" height="13" rx="2" fill="#143B68" />
        <rect x="0" y="88" width="13" height="13" rx="2" fill="#0B1B38" />

        <rect x="18" y="0" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="18" y="17" width="13" height="13" rx="2" fill="#1E4E8C" />
        <rect x="18" y="35" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="18" y="53" width="13" height="13" rx="2" fill="#2563EB" />
        <rect x="18" y="71" width="13" height="13" rx="2" fill="#0D9488" />
        <rect x="18" y="89" width="13" height="13" rx="2" fill="#143B68" />

        <rect x="36" y="2" width="13" height="13" rx="2" fill="#3B82F6" />
        <rect x="36" y="20" width="13" height="13" rx="2" fill="#0B1B38" />
        <rect x="36" y="38" width="13" height="13" rx="2" fill="#143B68" />
        <rect x="36" y="56" width="13" height="13" rx="2" fill="#16A34A" />
        <rect x="36" y="74" width="13" height="13" rx="2" fill="#22C55E" />

        <rect x="54" y="10" width="12" height="12" rx="2" fill="#0B1B38" />
        <rect x="54" y="29" width="11" height="11" rx="2" fill="#3B82F6" />
        <rect x="54" y="48" width="12" height="12" rx="2" fill="#16A34A" />
        <rect x="54" y="66" width="11" height="11" rx="2" fill="#4ADE80" />

        <rect x="71" y="18" width="10" height="10" rx="2" fill="#16A34A" />
        <rect x="71" y="40" width="9" height="9" rx="2" fill="#4ADE80" />
      </g>
    </svg>
  );
}

/**
 * Typographic CHITRAVITS Wordmark with Signature Rocket 'A'
 */
export function ChitravitsWordmark({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const textColor = dark ? '#FFFFFF' : '#0B1B38';

  return (
    <div className={`inline-flex items-center tracking-wider font-extrabold select-none ${className}`}>
      <span style={{ color: textColor, letterSpacing: '0.12em' }}>CHITR</span>
      {/* Signature Aerospace Delta Rocket 'A' */}
      <span className="relative inline-flex items-center justify-center mx-[1px]" style={{ width: '1.05em', height: '1.2em' }}>
        <svg viewBox="0 0 56 88" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="rocketOrange" x1="0%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
          {/* Outer Delta Arrow */}
          <path d="M 28,0 L 56,88 L 38,88 L 28,52 L 18,88 L 0,88 Z" fill="url(#rocketOrange)" />
          {/* Inner Void */}
          <polygon points="28,24 19,56 37,56" fill={dark ? '#060D1C' : '#FFFFFF'} />
          {/* Ascending Jet Silhouette */}
          <path d="M 28,34 L 32,58 L 28,54 L 24,58 Z" fill={textColor} />
        </svg>
      </span>
      <span style={{ color: textColor, letterSpacing: '0.12em' }}>VITS</span>
    </div>
  );
}

/**
 * Full Complete Chitravits Brand Lockup
 */
export function ChitravitsLogo({ size = 64, className = '', dark = false }: { size?: number; className?: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3.5 cursor-pointer ${className}`}>
      <ChitravitsEmblem size={size} />
      <div className="flex flex-col justify-center">
        <ChitravitsWordmark dark={dark} className="text-xl md:text-2xl" />
        <span
          className="text-[0.68rem] tracking-[0.22em] font-semibold uppercase opacity-75"
          style={{ color: dark ? '#93C5FD' : '#2A527A' }}
        >
          Imaging Intelligence From Space
        </span>
      </div>
    </div>
  );
}

export default ChitravitsLogo;
