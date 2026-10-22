/** Pays de la zone franc CFA de l'UEMOA (XOF), pour le choix du drapeau côté XOF. */
export const XOF_COUNTRIES = [
  { code: "BJ", name: "Bénin", dial: "229" },
  { code: "BF", name: "Burkina Faso", dial: "226" },
  { code: "CI", name: "Côte d'Ivoire", dial: "225" },
  { code: "GW", name: "Guinée-Bissau", dial: "245" },
  { code: "ML", name: "Mali", dial: "223" },
  { code: "NE", name: "Niger", dial: "227" },
  { code: "SN", name: "Sénégal", dial: "221" },
  { code: "TG", name: "Togo", dial: "228" },
] as const;

export type XofCountry = (typeof XOF_COUNTRIES)[number]["code"];

export function isXofCountry(value: unknown): value is XofCountry {
  return typeof value === "string" && XOF_COUNTRIES.some((c) => c.code === value);
}

/** Pays déduit d'un numéro international (+221… → Sénégal), sinon null. */
export function countryFromPhone(phone: string | null | undefined): XofCountry | null {
  if (!phone) return null;
  return XOF_COUNTRIES.find((c) => phone.startsWith(`+${c.dial}`))?.code ?? null;
}
