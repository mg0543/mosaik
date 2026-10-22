/**
 * Icône de l'application pour ImageResponse (PWA, iPhone, favicon) : le monogramme « M » de MEYA
 * en blanc sur le vert de la marque. `safeZone` réduit le motif pour les icônes « maskable »,
 * que les systèmes recadrent en cercle ou en carré arrondi.
 */
export function BrandIcon({ size, safeZone = 0.62, rounded = true }: { size: number; safeZone?: number; rounded?: boolean }) {
  const motif = Math.round(size * safeZone);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#00856a",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg width={motif} height={motif} viewBox="0 0 26 26">
        <path d="M5 21V5l8 8.5L21 5v16" fill="none" stroke="#ffffff" strokeWidth="3.2"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
