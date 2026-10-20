import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324/api/v1";

/** Adresse fictive unique pour un test (domaine réservé .test, aucune personne réelle). */
export function testEmail(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.test`;
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

/** Demande un code et l'envoie, comme un utilisateur. */
export async function requestCode(page: Page, email: string): Promise<void> {
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
