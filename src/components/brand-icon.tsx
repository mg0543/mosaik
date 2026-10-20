/**
 * Icône de l'application pour ImageResponse (PWA, iPhone, favicon) : la mosaïque du logo
 * en blanc sur le vert de la marque. `safeZone` réduit le motif pour les icônes « maskable »,
 * que les systèmes recadrent en cercle ou en carré arrondi.
 */
export function BrandIcon({ size, safeZone = 0.62, rounded = true }: { size: number; safeZone?: number; rounded?: boolean }) {
  const motif = size * safeZone;
  const unit = motif / 26;
  const tile = (x: number, y: number, w: number, h: number, opacity: number) => (
    <div
      style={{
        position: "absolute",
        left: x * unit,
        top: y * unit,
        width: w * unit,
        height: h * unit,
        borderRadius: 3 * unit,
        background: "#ffffff",
        opacity,
      }}
    />
  );
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
      <div style={{ position: "relative", width: motif, height: motif, display: "flex" }}>
        {tile(0, 0, 15, 11, 1)}
        {tile(17, 0, 9, 11, 0.7)}
        {tile(0, 13, 8, 13, 0.7)}
        {tile(10, 13, 16, 13, 0.9)}
      </div>
    </div>
  );
}
