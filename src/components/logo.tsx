/** Logo MEYA : monogramme « M » blanc sur le vert de la marque. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect width="26" height="26" rx="7" fill="var(--accent)" />
      <path d="M7 18.5V8l6 6.5L19 8v10.5" fill="none" stroke="#ffffff" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
