/**
 * Illustrations MEYA, dessinées en SVG (aucune image externe) et adaptées au thème clair ou sombre.
 * Elles sont décoratives : masquées aux lecteurs d'écran.
 */

/** Deux pièces, l'euro et le franc CFA, reliées par des flèches d'échange. */
export function ExchangeIllustration({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" aria-hidden="true" className="illustration">
      <circle cx="110" cy="110" r="100" fill="var(--hero-glow)" />
      <path d="M62 78a62 62 0 0 1 96 0" fill="none" stroke="var(--sun)" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 64l9 15-17 2" fill="none" stroke="var(--sun)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M158 142a62 62 0 0 1-96 0" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" />
      <path d="M70 156l-9-15 17-2" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="112" r="34" fill="#ffffff" />
      <text x="72" y="124" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--hero)">€</text>
      <circle cx="148" cy="112" r="34" fill="var(--sun)" />
      <text x="148" y="119" textAnchor="middle" fontSize="19" fontWeight="800" fill="var(--hero)">CFA</text>
    </svg>
  );
}

/** Icônes des étapes « Comment ça marche ». */
export function StepIcon({ name }: { name: "amount" | "match" | "settle" | "shield" | "rate" | "free" }) {
  const paths: Record<typeof name, string> = {
    amount: "M5 7h14M5 12h9M5 17h6M17 14l3 3-3 3",
    match: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0",
    settle: "M4 12l5 5L20 6",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
    rate: "M4 17l5-5 4 4 7-7M15 9h5v5",
    free: "M12 3v18M7 7h7.5a3.5 3.5 0 0 1 0 7H7M7 14h8.5a3.5 3.5 0 0 1 0 7",
  };
  return (
    <span className="step-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}
