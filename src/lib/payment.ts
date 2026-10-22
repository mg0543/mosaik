/**
 * Coordonnées de réception : validation et affichage. Aucune de ces fonctions ne déplace
 * d'argent ; elles garantissent seulement qu'une coordonnée est bien formée.
 */

export const XOF_OPERATORS = {
  orange_money: "Orange Money",
  wave: "Wave",
  mtn_momo: "MTN Mobile Money",
  moov_money: "Moov Money",
  free_money: "Free Money",
} as const;

export type XofOperator = keyof typeof XOF_OPERATORS;

/** Indicatifs des pays qui utilisent le franc CFA de l'UEMOA (XOF). */
const XOF_COUNTRY_CODES = ["221", "223", "225", "226", "227", "228", "229", "245"] as const;

/** Coordonnée figée dans un règlement : où envoyer l'argent, et à quel nom. */
export type PayTo = {
  method: "iban" | XofOperator;
  account: string;
  holder: string;
};

/** Coordonnées de réception d'un utilisateur (null tant qu'elles ne sont pas renseignées). */
export interface PaymentDetails {
  eurIban: string | null;
  eurHolder: string | null;
  xofOperator: XofOperator | null;
  xofPhone: string | null;
  xofHolder: string | null;
}

/** Devise que reçoit un ordre de ce côté : SELL_XOF reçoit des euros, SELL_EUR des XOF. */
export function receivedCurrency(side: "SELL_EUR" | "SELL_XOF"): "EUR" | "XOF" {
  return side === "SELL_XOF" ? "EUR" : "XOF";
}

/** Coordonnée de réception dans une devise, telle qu'elle sera figée dans un règlement ; null si absente. */
export function payToFor(details: PaymentDetails, currency: "EUR" | "XOF"): PayTo | null {
  if (currency === "EUR") {
    return details.eurIban && details.eurHolder ? { method: "iban", account: details.eurIban, holder: details.eurHolder } : null;
  }
  return details.xofOperator && details.xofPhone && details.xofHolder
    ? { method: details.xofOperator, account: details.xofPhone, holder: details.xofHolder }
    : null;
}

const compact = (input: string) => input.replace(/[\s.\-  ]/g, "");

/** Vérifie la clé de contrôle d'un IBAN (norme ISO 13616, modulo 97). */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = char >= "A" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Lit un IBAN saisi librement (espaces, minuscules) ; renvoie sa forme normalisée. */
export function parseIban(input: string): string {
  const iban = compact(input).toUpperCase();
  if (!isValidIban(iban)) throw new RangeError("IBAN invalide : vérifiez sa saisie.");
  return iban;
}

/** Lit un numéro mobile money de la zone XOF ; renvoie sa forme internationale (+221…). */
export function parseXofPhone(input: string): string {
  let phone = compact(input);
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  const match = /^\+(\d{3})(\d{7,10})$/.exec(phone);
  if (!match || !(XOF_COUNTRY_CODES as readonly string[]).includes(match[1])) {
    throw new RangeError("Numéro invalide : indicatif d'un pays de la zone XOF requis (ex. +221 77 123 45 67).");
  }
  return phone;
}

/** Nom du titulaire : 2 à 70 caractères, espaces superflus retirés. */
export function parseHolder(input: string): string {
  const holder = input.replace(/\s+/g, " ").trim();
  if (holder.length < 2 || holder.length > 70) throw new RangeError("Nom du titulaire : 2 à 70 caractères.");
  return holder;
}

export function isXofOperator(value: unknown): value is XofOperator {
  return typeof value === "string" && value in XOF_OPERATORS;
}

/** IBAN par groupes de 4 : FR76 3000 6000 0112 3456 7890 189. */
export function fmtIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Numéro lisible : +221 77 123 45 67 (impair : 2, 3 puis par deux) ou +225 07 08 09 10 11. */
export function fmtPhone(phone: string): string {
  const match = /^\+(\d{3})(\d+)$/.exec(phone);
  if (!match) return phone;
  const rest = match[2];
  const groups =
    rest.length % 2 === 1
      ? [rest.slice(0, 2), rest.slice(2, 5), ...(rest.slice(5).match(/.{2}/g) ?? [])]
      : (rest.match(/.{2}/g) ?? []);
  return [`+${match[1]}`, ...groups].join(" ");
}

/** Libellé complet d'une coordonnée figée. */
export function describePayTo(payTo: PayTo): { method: string; account: string; holder: string } {
  return payTo.method === "iban"
    ? { method: "Virement bancaire (IBAN)", account: fmtIban(payTo.account), holder: payTo.holder }
    : { method: XOF_OPERATORS[payTo.method], account: fmtPhone(payTo.account), holder: payTo.holder };
}

/** IBAN masqué pour un affichage discret : FR76 •••• 0189. */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
}

/** Numéro masqué : +221 •• •• 45 67. */
export function maskPhone(phone: string): string {
  const match = /^\+(\d{3})\d*(\d{2})(\d{2})$/.exec(phone);
  return match ? `+${match[1]} •• •• ${match[2]} ${match[3]}` : phone;
}
