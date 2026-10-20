import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

const MAILPIT = "http://127.0.0.1:54324/api/v1";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** IBAN d'exemple publié (aucun compte réel). */
export const EXAMPLE_IBAN = "FR76 3000 6000 0112 3456 7890 189";

/** Adresse fictive unique pour un test (domaine réservé .test, aucune personne réelle). */
export function testEmail(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.test`;
}

/** Invite une adresse au pilote, comme le ferait l'administrateur (base locale uniquement). */
export async function invite(email: string): Promise<void> {
  const sql = postgres(process.env.E2E_DATABASE_URL ?? LOCAL_DB, { max: 1 });
  try {
    await sql`insert into public.pilot_invites (email) values (${email}) on conflict do nothing`;
  } finally {
    await sql.end();
  }
}

/** Dernier e-mail reçu par cette adresse dans la boîte de test locale (Mailpit). */
async function latestEmail(email: string): Promise<{ text: string; html: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await (await fetch(`${MAILPIT}/message/${id}`)).json();
      return { text: message.Text ?? "", html: message.HTML ?? "" };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Aucun e-mail reçu pour ${email}`);
}

export async function codeFromEmail(email: string): Promise<string> {
  const { text, html } = await latestEmail(email);
  const code = /\b(\d{6})\b/.exec(text || html)?.[1];
  if (!code) throw new Error("Code introuvable dans l'e-mail");
  return code;
}

export async function linkFromEmail(email: string): Promise<string> {
  const { html } = await latestEmail(email);
  const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(html)?.[1];
  if (!href) throw new Error("Lien de connexion introuvable dans l'e-mail");
  // Seuls le chemin et le jeton comptent : on vise le serveur de test, quel que soit son port.
  const url = new URL(href.replace(/&amp;/g, "&"));
  return `${url.pathname}${url.search}`;
}

/** Demande un code et l'envoie, comme un utilisateur invité. */
export async function requestCode(page: Page, email: string): Promise<void> {
  await invite(email);
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await expect(page.getByLabel("Code reçu par e-mail")).toBeVisible();
}

export async function loginWithCode(page: Page, email: string): Promise<void> {
  await requestCode(page, email);
  await page.getByLabel("Code reçu par e-mail").fill(await codeFromEmail(email));
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Renseigne les coordonnées de réception depuis l'écran Compte. */
export async function fillPaymentDetails(
  page: Page,
  details: { iban?: string; ibanHolder?: string; phone?: string; phoneHolder?: string },
): Promise<void> {
  await page.goto("/app/compte");
  if (details.iban) {
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Pour recevoir des euros" }) });
    await form.getByLabel("IBAN").fill(details.iban);
    await form.getByLabel("Titulaire du compte").fill(details.ibanHolder ?? "Titulaire Test");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(form.getByText("Coordonnées enregistrées.")).toBeVisible();
  }
  if (details.phone) {
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Pour recevoir des XOF" }) });
    await form.getByLabel("Opérateur mobile money").selectOption("wave");
    await form.getByLabel(/Numéro/).fill(details.phone);
    await form.getByLabel("Nom du titulaire").fill(details.phoneHolder ?? "Titulaire Test");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(form.getByText("Coordonnées enregistrées.")).toBeVisible();
  }
}

/** Passe un ordre depuis l'écran Échanger et renvoie l'URL de son détail. */
export async function placeOrder(
  page: Page,
  order: { direction: "XOF → EUR" | "EUR → XOF"; amount: string; rate: string },
): Promise<string> {
  await page.goto("/app/echanger");
  await page.getByRole("button", { name: new RegExp(order.direction) }).click();
  await page.getByLabel("Montant à échanger").fill(order.amount);
  await page.getByLabel(/Taux (maximum|minimum) que j'accepte/).fill(order.rate);
  await page.getByRole("button", { name: "Confirmer l'ordre" }).click();
  await expect(page).toHaveURL(/\/app\/ordres\/[0-9a-f-]{36}\?nouveau=1$/);
  return page.url().replace(/\?nouveau=1$/, "");
}

/** Coche la case de confirmation d'une étape du règlement puis valide. */
export async function confirmStep(page: Page, checkbox: RegExp, button: string): Promise<void> {
  await page.getByRole("checkbox", { name: checkbox }).check();
  await page.getByRole("button", { name: button }).click();
}
