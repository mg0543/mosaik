import { expect, test } from "@playwright/test";
import { linkFromEmail, loginWithCode, placeOrder, requestCode, testEmail } from "./helpers";

test.describe("visiteur", () => {
  test("voit l'accueil et est redirigé vers la connexion hors de son espace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Échangez vos euros");
    await expect(page.getByRole("heading", { name: "Le marché en ce moment" })).toBeVisible();

    await page.goto("/app/ordres");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("ne peut pas se connecter avec un mauvais code", async ({ page }) => {
    await requestCode(page, testEmail("mauvais-code"));
    await page.getByLabel("Code reçu par e-mail").fill("000000");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("#login-message")).toHaveText("Code incorrect ou expiré.");
  });
});

test("deux participants s'échangent des devises de bout en bout", async ({ browser }) => {
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  const pageA = await alice.newPage();
  const pageB = await bob.newPage();
  const emailA = testEmail("alice");
  const emailB = testEmail("bob");

  // Alice se connecte avec le code et propose 656 000 XOF au plus 656 XOF/€ : personne en face.
  await loginWithCode(pageA, emailA);
  await expect(pageA.getByText(emailA)).toBeVisible();
  const orderA = await placeOrder(pageA, { direction: "XOF → EUR", amount: "656 000", rate: "656" });
  await expect(pageA.getByText("Il attend dans le carnet")).toBeVisible();
  await expect(pageA.getByText("En attente", { exact: true }).first()).toBeVisible();

  // Bob se connecte avec le lien de l'e-mail et vend 500 € à 650 minimum : il croise Alice à 656.
  await requestCode(pageB, emailB);
  await pageB.goto(await linkFromEmail(emailB));
  await expect(pageB).toHaveURL(/\/app$/);
  const orderB = await placeOrder(pageB, { direction: "EUR → XOF", amount: "500", rate: "650" });
  await expect(pageB.getByText("Servi tout de suite par 1 contrepartie.")).toBeVisible();
  await expect(pageB.getByText("Servi", { exact: true })).toBeVisible();
  await expect(pageB.getByText(/Reçu : 328\s000 XOF/)).toBeVisible();
  await expect(pageB.getByText(/Taux 656 · servi à l'arrivée/)).toBeVisible();

  // Alice voit son ordre partiellement servi, au taux qu'elle avait fixé.
  await pageA.goto(orderA);
  await expect(pageA.getByText("Partiellement servi")).toBeVisible();
  await expect(pageA.getByText(/Reçu : 500,00\s€/)).toBeVisible();
  await expect(pageA.getByText(/votre ordre attendait dans le carnet/)).toBeVisible();

  // Bob ne peut pas ouvrir l'ordre d'Alice, même avec son adresse exacte.
  const forbidden = await pageB.goto(orderA);
  expect(forbidden?.status()).toBe(404);
  await expect(pageB.getByRole("heading", { name: "Introuvable" })).toBeVisible();
  await expect(pageB.getByText(/656\s000 XOF/)).toHaveCount(0);

  // Alice annule le reste de son ordre.
  await pageA.getByRole("button", { name: "Annuler l'ordre" }).click();
  await pageA.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(pageA.getByText("Annulé, servi en partie")).toBeVisible();
  await expect(pageA.getByRole("button", { name: "Annuler l'ordre" })).toHaveCount(0);

  // L'ordre de Bob reste consultable par lui.
  await pageB.goto(orderB);
  await expect(pageB.getByText("Servi", { exact: true })).toBeVisible();

  await alice.close();
  await bob.close();
});

test("l'écran Échanger bloque un taux aberrant et montre l'aperçu", async ({ page }) => {
  await loginWithCode(page, testEmail("garde-fous"));
  await page.goto("/app/echanger");
  await page.getByLabel("Montant à échanger").fill("100 000");
  await page.getByLabel("Taux maximum que j'accepte").fill("6559");
  await expect(page.getByText(/Taux hors limites/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer l'ordre" })).toBeDisabled();

  await page.getByLabel("Taux maximum que j'accepte").fill("660");
  await expect(page.getByRole("button", { name: "Confirmer l'ordre" })).toBeEnabled();
});

test("la déconnexion ferme l'accès à l'espace", async ({ page }) => {
  await loginWithCode(page, testEmail("deconnexion"));
  await page.goto("/app/compte");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/connexion$/);
});
