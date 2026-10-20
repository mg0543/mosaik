import { expect, test } from "@playwright/test";
import {
  confirmStep,
  EXAMPLE_IBAN,
  fillPaymentDetails,
  linkFromEmail,
  loginWithCode,
  placeOrder,
  requestCode,
  testEmail,
} from "./helpers";

test.describe("visiteur", () => {
  test("voit l'accueil et est redirigé vers la connexion hors de son espace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Échangez vos euros");
    await expect(page.getByRole("heading", { name: "Le marché en ce moment" })).toBeVisible();

    await page.goto("/app/ordres");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("trouve les conditions et la politique de confidentialité depuis la connexion", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: "conditions du pilote", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conditions du pilote");
    await page.goto("/connexion");
    await page.getByRole("link", { name: "politique de confidentialité", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Politique de confidentialité");
  });

  test("ne reçoit pas de code sans invitation", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(testEmail("non-invite"));
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await expect(page.locator("#login-message")).toHaveText(
      "Le pilote est sur invitation : cette adresse n'a pas encore été invitée.",
    );
  });

  test("ne peut pas se connecter avec un mauvais code", async ({ page }) => {
    await requestCode(page, testEmail("mauvais-code"));
    await page.getByLabel("Code reçu par e-mail").fill("000000");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("#login-message")).toHaveText("Code incorrect ou expiré.");
  });
});

test("deux participants s'échangent des devises et règlent l'échange de bout en bout", async ({ browser }) => {
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  const pageA = await alice.newPage();
  const pageB = await bob.newPage();
  const emailA = testEmail("alice");
  const emailB = testEmail("bob");

  // Alice se connecte avec le code, renseigne son IBAN, et propose 492 000 XOF au plus 656 XOF/€.
  await loginWithCode(pageA, emailA);
  await expect(pageA.getByText(emailA)).toBeVisible();
  await fillPaymentDetails(pageA, { iban: EXAMPLE_IBAN, ibanHolder: "Alice Test" });
  const orderA = await placeOrder(pageA, { direction: "XOF → EUR", amount: "492 000", rate: "656" });
  await expect(pageA.getByText("Il attend dans le carnet")).toBeVisible();

  // Bob se connecte avec le lien de l'e-mail, renseigne son Wave et vend 500 € : il croise Alice à 656.
  await requestCode(pageB, emailB);
  await pageB.goto(await linkFromEmail(emailB));
  await expect(pageB).toHaveURL(/\/app$/);
  await fillPaymentDetails(pageB, { phone: "+221 77 000 00 02", phoneHolder: "Bob Test" });
  const orderB = await placeOrder(pageB, { direction: "EUR → XOF", amount: "500", rate: "650" });
  await expect(pageB.getByText("Servi tout de suite par 1 contrepartie.")).toBeVisible();
  await expect(pageB.getByText(/Vous recevez : 328\s000 XOF/)).toBeVisible();

  // 1. Bob, arrivé en dernier, paie en premier : il voit l'IBAN d'Alice.
  await expect(pageB.getByText("Action requise")).toBeVisible();
  await expect(pageB.getByText(/envoyez exactement\s+500,00\s€/)).toBeVisible();
  await expect(pageB.getByText(EXAMPLE_IBAN)).toBeVisible();
  await expect(pageB.getByText("Alice Test", { exact: true })).toBeVisible();
  await expect(pageB.getByRole("button", { name: "J'ai envoyé l'argent" })).toBeDisabled();
  await confirmStep(pageB, /J'ai envoyé 500,00\s€ à Alice Test/, "J'ai envoyé l'argent");
  await expect(pageB.getByText("La contrepartie doit confirmer qu'elle a bien reçu votre paiement.", { exact: false })).toBeVisible();

  // 2. Alice voit la tâche sur son accueil, confirme la réception, puis 3. envoie sa part au Wave de Bob.
  await pageA.goto("/app");
  await expect(pageA.getByRole("heading", { name: "À faire (1)" })).toBeVisible();
  await pageA.getByRole("link", { name: /Confirmer une réception/ }).click();
  await expect(pageA).toHaveURL(orderA);
  await confirmStep(pageA, /J'ai reçu 500,00\s€ sur mon compte/, "J'ai bien reçu l'argent");
  await expect(pageA.getByText(/envoyez exactement\s+328\s000 XOF/)).toBeVisible();
  await expect(pageA.getByText("+221 77 000 00 02")).toBeVisible();
  await expect(pageA.getByText("Wave", { exact: true })).toBeVisible();
  await confirmStep(pageA, /J'ai envoyé 328\s000 XOF à Bob Test/, "J'ai envoyé l'argent");

  // 4. Bob confirme la réception : l'échange est réglé des deux côtés.
  await pageB.goto(orderB);
  await confirmStep(pageB, /J'ai reçu 328\s000 XOF sur mon compte/, "J'ai bien reçu l'argent");
  await expect(pageB.getByText("Échange réglé : les deux paiements sont confirmés.")).toBeVisible();
  await pageA.goto(orderA);
  await expect(pageA.getByText("Réglé", { exact: true })).toBeVisible();
  await expect(pageA.getByText("Partiellement servi")).toBeVisible();

  // Bob ne peut pas ouvrir l'ordre d'Alice, même avec son adresse exacte.
  const forbidden = await pageB.goto(orderA);
  expect(forbidden?.status()).toBe(404);
  await expect(pageB.getByRole("heading", { name: "Introuvable" })).toBeVisible();

  // Alice annule le reste de son ordre (164 000 XOF).
  await pageA.goto(orderA);
  await pageA.getByRole("button", { name: "Annuler l'ordre" }).click();
  await pageA.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(pageA.getByText("Annulé, servi en partie")).toBeVisible();

  await alice.close();
  await bob.close();
});

test("un litige gèle le règlement", async ({ browser }) => {
  const maker = await (await browser.newContext()).newPage();
  const taker = await (await browser.newContext()).newPage();

  await loginWithCode(maker, testEmail("litige-a"));
  await fillPaymentDetails(maker, { phone: "+225 07 00 00 00 03", phoneHolder: "Awa Test" });
  await placeOrder(maker, { direction: "EUR → XOF", amount: "100", rate: "660" });

  await loginWithCode(taker, testEmail("litige-b"));
  await fillPaymentDetails(taker, { iban: EXAMPLE_IBAN, ibanHolder: "Jean Test" });
  await placeOrder(taker, { direction: "XOF → EUR", amount: "66 000", rate: "670" });
  await expect(taker.getByText(/envoyez exactement\s+66\s000 XOF/)).toBeVisible();

  await taker.getByRole("button", { name: "Signaler un problème" }).click();
  await taker.getByLabel("Que se passe-t-il ?").fill("La contrepartie me demande d'envoyer sur un autre numéro.");
  await taker.getByRole("button", { name: "Signaler", exact: true }).click();
  await expect(taker.getByText("Litige signalé par vous.")).toBeVisible();
  await expect(taker.getByRole("button", { name: "J'ai envoyé l'argent" })).toHaveCount(0);
  await expect(taker.getByText("Litige signalé", { exact: true })).toBeVisible();
});

test("l'écran Échanger bloque un taux aberrant et exige les coordonnées de réception", async ({ page }) => {
  await loginWithCode(page, testEmail("garde-fous"));
  await page.goto("/app/echanger");
  await page.getByLabel("Montant à échanger").fill("100 000");
  await page.getByLabel("Taux maximum que j'accepte").fill("6559");
  await expect(page.getByText(/Taux hors limites/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer l'ordre" })).toBeDisabled();

  await page.getByLabel("Taux maximum que j'accepte").fill("660");
  await expect(page.getByText(/renseignez d'abord\s+votre IBAN/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer l'ordre" })).toBeDisabled();

  await fillPaymentDetails(page, { iban: EXAMPLE_IBAN });
  await page.goto("/app/echanger");
  await page.getByLabel("Montant à échanger").fill("100 000");
  await page.getByLabel("Taux maximum que j'accepte").fill("660");
  await expect(page.getByRole("button", { name: "Confirmer l'ordre" })).toBeEnabled();
});

test("refuse un IBAN dont la clé de contrôle est fausse", async ({ page }) => {
  await loginWithCode(page, testEmail("iban"));
  await page.goto("/app/compte");
  const form = page.locator("form", { has: page.getByRole("heading", { name: "Pour recevoir des euros" }) });
  await form.getByLabel("IBAN").fill("FR76 3000 6000 0112 3456 7890 188");
  await form.getByLabel("Titulaire du compte").fill("Jean Test");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByRole("alert")).toHaveText("IBAN invalide : vérifiez sa saisie.");
});

test("la déconnexion ferme l'accès à l'espace", async ({ page }) => {
  await loginWithCode(page, testEmail("deconnexion"));
  await page.goto("/app/compte");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/connexion$/);
});
