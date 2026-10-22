/**
 * Règles de saisie de l'inscription, partagées par le formulaire (retour immédiat) et le
 * serveur (qui fait foi). Les mêmes limites sont imposées par la base.
 */

export const PASSWORD_MIN_LENGTH = 10;
/** Au-delà, l'algorithme de hachage ignore la fin du mot de passe. */
export const PASSWORD_MAX_LENGTH = 72;

/** Raison du refus d'un mot de passe, ou null s'il convient. */
export function checkPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  return null;
}

/** Prénom ou nom : 1 à 50 caractères, lettres (accents compris), espaces, tirets et apostrophes. */
export function parseName(input: string, label: "Prénom" | "Nom"): string {
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 50 || !/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(name)) {
    throw new RangeError(`${label} invalide.`);
  }
  return name;
}

/**
 * Téléphone facultatif, au format international (+221 77 123 45 67, +33 6 12 34 56 78).
 * Renvoie null si le champ est vide, la forme normalisée (+33612345678) sinon.
 */
export function parseOptionalPhone(input: string): string | null {
  let phone = input.replace(/[\s.\-()  ]/g, "");
  if (phone === "") return null;
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new RangeError("Numéro invalide : format international attendu, avec l'indicatif (ex. +221 77 123 45 67).");
  }
  return phone;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adresse e-mail normalisée (minuscules, sans espaces). */
export function parseEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new RangeError("Adresse e-mail invalide.");
  return email;
}
