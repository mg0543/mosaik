/** Logo : une mosaïque de tuiles, comme un échange servi par plusieurs personnes. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="0" y="0" width="15" height="11" rx="3" fill="var(--accent)" />
      <rect x="17" y="0" width="9" height="11" rx="3" fill="var(--accent)" opacity="0.6" />
      <rect x="0" y="13" width="8" height="13" rx="3" fill="var(--accent)" opacity="0.6" />
      <rect x="10" y="13" width="16" height="13" rx="3" fill="var(--accent)" opacity="0.85" />
    </svg>
  );
}
