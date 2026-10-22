import { expect, test } from "@playwright/test";
import {
  codeFromEmail,
  confirmStep,
  EXAMPLE_IBAN,
  fillPaymentDetails,
  invite,
  logIn,
  placeOrder,
  signUp,
  TEST_PASSWORD,
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

  test("trouve les conditions et la politique de confidentialité depuis l'inscription", async ({ page }) => {
    await page.goto("/inscription");
    const terms = page.getByRole("link", { name: "conditions du pilote", exact: true });
    await expect(terms).toHaveAttribute("href", "/conditions");
    await page.goto(await terms.getAttribute("href") ?? "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conditions du pilote");
    await page.goto("/inscription");
    await page.goto(await page.getByRole("link", { name: "politique de confidentialité", exact: true }).getAttribute("href") ?? "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Politique de confidentialité");
  });

  test("passe de la connexion à l'inscription et inversement", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: "S'inscrire" }).first().click();
    await expect(page).toHaveURL(/\/inscription$/);
    await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
    await page.getByRole("navigation", { name: "Connexion ou inscription" }).getByRole("link", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("ne peut pas s'inscrire sans invitation", async ({ page }) => {
    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel("Nom", { exact: true }).fill("Diop");
    await page.getByLabel("Adresse e-mail").fill(testEmail("non-invite"));
    await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("checkbox", { name: /J'accepte les conditions/ }).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#auth-message")).toHaveText(
      "Le pilote est sur invitation : cette adresse n'a pas encore été invitée.",
    );
  });
});

test.describe("compte", () => {
  test("s'inscrit, se déconnecte puis se reconnecte avec son mot de passe", async ({ page }) => {
    const account = await signUp(page, "awa", { phone: "+221 77 123 45 67" });
    await expect(page.getByRole("heading", { name: "Bonjour Awa" })).toBeVisible();
    await page.goto("/app/compte");
    await expect(page.getByText("Awa Test")).toBeVisible();
    await expect(page.getByText("+221771234567")).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/connexion$/);

    await logIn(page, account.email, "mauvais-mot-de-passe1");
    await expect(page.locator("#auth-message")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
    await logIn(page, account.email, account.password);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("le téléphone est facultatif mais doit être valide s'il est donné", async ({ page }) => {
    const email = testEmail("tel");
    await invite(email);
    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill("Jean");
    await page.getByLabel("Nom", { exact: true }).fill("Martin");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel(/Téléphone/).fill("06 12 34 56 78");
    await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill("autre-mot2passe");
    await page.getByRole("checkbox", { name: /J'accepte les conditions/ }).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#auth-message")).toContainText("format international");
    // Les champs déjà saisis sont conservés.
    await expect(page.getByLabel("Prénom")).toHaveValue("Jean");

    await page.getByLabel(/Téléphone/).fill("");
    await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill("autre-mot2passe");
    await page.getByRole("checkbox", { name: /J'accepte les conditions/ }).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#auth-message")).toHaveText("Les deux mots de passe ne sont pas identiques.");

    await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("checkbox", { name: /J'accepte les conditions/ }).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("refuse un mot de passe trop faible", async ({ page }) => {
    const email = testEmail("faible");
    await invite(email);
    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill("Jean");
    await page.getByLabel("Nom", { exact: true }).fill("Martin");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("motdepasse");
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill("motdepasse");
    await page.getByRole("checkbox", { name: /J'accepte les conditions/ }).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("#auth-message")).toHaveText("Le mot de passe doit contenir au moins une lettre et un chiffre.");
  });

  test("réinitialise un mot de passe oublié avec le code reçu par e-mail", async ({ page }) => {
    const account = await signUp(page, "oubli");
    await page.goto("/app/compte");
    await page.getByRole("button", { name: "Se déconnecter" }).click();

    await page.goto("/connexion");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await page.getByLabel("Adresse e-mail du compte").fill(account.email);
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    await page.getByLabel("Code reçu par e-mail").fill(await codeFromEmail(account.email));
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("nouveau2026motdepasse");
    await page.getByLabel("Confirmer le nouveau mot de passe", { exact: true }).fill("nouveau2026motdepasse");
    await page.getByRole("button", { name: "Changer mon mot de passe" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/compte");
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await logIn(page, account.email, account.password);
    await expect(page.locator("#auth-message")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
    await logIn(page, account.email, "nouveau2026motdepasse");
    await expect(page).toHaveURL(/\/app$/);
  });
});

test("deux participants s'échangent des devises et règlent l'échange de bout en bout", async ({ browser }) => {
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  const pageA = await alice.newPage();
  const pageB = await bob.newPage();

  // Alice s'inscrit, renseigne son IBAN, et propose 492 000 XOF au plus 656 XOF/€.
  await signUp(pageA, "alice");
  await fillPaymentDetails(pageA, { iban: EXAMPLE_IBAN, ibanHolder: "Alice Test" });
  const orderA = await placeOrder(pageA, { direction: "XOF → EUR", amount: "492 000", rate: "656" });
  await expect(pageA.getByText("Il attend dans le carnet")).toBeVisible();

  // Bob s'inscrit, renseigne son Wave et vend 500 € : il croise Alice à 656.
  await signUp(pageB, "bob");
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

  await signUp(maker, "litige-a");
  await fillPaymentDetails(maker, { phone: "+225 07 00 00 00 03", phoneHolder: "Awa Test" });
  await placeOrder(maker, { direction: "EUR → XOF", amount: "100", rate: "660" });

  await signUp(taker, "litige-b");
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
  await signUp(page, "garde-fous");
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
  await signUp(page, "iban");
  await page.goto("/app/compte");
  const form = page.locator("form", { has: page.getByRole("heading", { name: "Pour recevoir des euros" }) });
  await form.getByLabel("IBAN").fill("FR76 3000 6000 0112 3456 7890 188");
  await form.getByLabel("Titulaire du compte").fill("Jean Test");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByRole("alert")).toHaveText("IBAN invalide : vérifiez sa saisie.");
});
