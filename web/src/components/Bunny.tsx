/** Aye's mascot — clean blue bunny. */
export function Bunny({ size = 96, hop = false }: { size?: number; hop?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={hop ? 'hop' : ''}
      aria-hidden
    >
      <ellipse cx="32" cy="58" rx="18" ry="3" fill="#0F172A" opacity="0.06" />
      <circle cx="32" cy="36" r="20" fill="#E0F2FE" />
      <circle cx="32" cy="36" r="20" fill="#397CD5" opacity="0.15" />
      <ellipse cx="23" cy="16" rx="5.5" ry="10" fill="#E0F2FE" />
      <ellipse cx="41" cy="16" rx="5.5" ry="10" fill="#E0F2FE" />
      <ellipse cx="23" cy="16" rx="2.5" ry="5.5" fill="#397CD5" opacity="0.4" />
      <ellipse cx="41" cy="16" rx="2.5" ry="5.5" fill="#397CD5" opacity="0.4" />
      <circle cx="26" cy="34" r="2" fill="#0F172A" />
      <circle cx="38" cy="34" r="2" fill="#0F172A" />
      <circle cx="26.5" cy="33.5" r="0.7" fill="white" />
      <circle cx="38.5" cy="33.5" r="0.7" fill="white" />
      <ellipse cx="32" cy="40" rx="2.5" ry="1.5" fill="#EF4444" opacity="0.5" />
      <path d="M32 42 Q29 45 26 44" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4" />
      <path d="M32 42 Q35 45 38 44" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  )
}
