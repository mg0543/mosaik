import { expect, test } from "@playwright/test";
import {
  codeFromEmail,
  grantAdmin,
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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Changez vos euros");
    // Convertisseur public : estimation immédiate, puis invitation à créer un compte.
    await expect(page.getByLabel("Montant reçu")).toHaveText(/\d/);
    await page.getByLabel("Montant envoyé").fill("100");
    await expect(page.getByLabel("Montant reçu")).toHaveText("65 595");
    await expect(page.getByRole("link", { name: "Créer un compte pour échanger" })).toBeVisible();

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
    await expect(page.getByRole("heading", { name: /Bonjour Awa/ })).toBeVisible();
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
  // Parcours à deux utilisateurs en plusieurs étapes : plus long que la limite par défaut.
  test.setTimeout(60_000);
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  const pageA = await alice.newPage();
  const pageB = await bob.newPage();

  // Alice s'inscrit, renseigne son IBAN, et propose 492 000 XOF au plus 656 XOF/€.
  await signUp(pageA, "alice");
  await fillPaymentDetails(pageA, { iban: EXAMPLE_IBAN, ibanHolder: "Alice Test" });
  const orderA = await placeOrder(pageA, { direction: "XOF → EUR", amount: "492 000", rate: "656" });
  await expect(pageA.getByText("Votre demande est publiée")).toBeVisible();

  // Bob s'inscrit, renseigne son Wave et vend 500 € : il croise Alice à 656.
  await signUp(pageB, "bob");
  await fillPaymentDetails(pageB, { phone: "+221 77 000 00 02", phoneHolder: "Bob Test" });
  const orderB = await placeOrder(pageB, { direction: "EUR → XOF", amount: "500", rate: "650" });
  await expect(pageB.getByText("1 partenaire a été trouvé tout de suite.")).toBeVisible();
  await expect(pageB.getByText(/Vous recevez : 328\s000 XOF/)).toBeVisible();

  // 1. Bob, arrivé en dernier, paie en premier : il voit l'IBAN d'Alice.
  await expect(pageB.getByText("À vous de jouer")).toBeVisible();
  await expect(pageB.getByText(/envoyez exactement\s+500,00\s€/)).toBeVisible();
  await expect(pageB.getByText(EXAMPLE_IBAN)).toBeVisible();
  await expect(pageB.getByText("Alice Test", { exact: true })).toBeVisible();
  await expect(pageB.getByRole("button", { name: "J'ai envoyé l'argent" })).toBeDisabled();
  await confirmStep(pageB, /J'ai envoyé 500,00\s€ à Alice Test/, "J'ai envoyé l'argent");
  await expect(pageB.getByText("Votre partenaire doit confirmer qu'il a bien reçu votre paiement.", { exact: false })).toBeVisible();

  // 2. Alice voit la tâche sur son accueil, confirme la réception, puis 3. envoie sa part au Wave de Bob.
  await pageA.goto("/app/activite");
  await expect(pageA.getByRole("heading", { name: "À faire (1)" })).toBeVisible();
  await pageA.getByRole("link", { name: /Confirmer une réception/ }).click();
  await expect(pageA).toHaveURL(new RegExp(`^${orderA}`));
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
  await expect(pageA.getByText("Servi en partie")).toBeVisible();

  // Bob ne peut pas ouvrir l'ordre d'Alice, même avec son adresse exacte.
  const forbidden = await pageB.goto(orderA);
  expect(forbidden?.status()).toBe(404);
  await expect(pageB.getByRole("heading", { name: "Introuvable" })).toBeVisible();

  // Alice annule le reste de son ordre (164 000 XOF).
  await pageA.goto(orderA);
  await pageA.getByRole("button", { name: "Annuler la partie en attente" }).click();
  await pageA.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(pageA.getByText("Annulé, servi en partie")).toBeVisible();

  await alice.close();
  await bob.close();
});

test("un litige gèle le règlement", async ({ browser }) => {
  // Parcours à deux utilisateurs en plusieurs étapes : plus long que la limite par défaut.
  test.setTimeout(60_000);
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

test("le convertisseur bloque un taux aberrant et exige les coordonnées de réception", async ({ page }) => {
  await signUp(page, "gardefous");
  await page.goto("/app/echanger");
  await page.getByRole("button", { name: "J'envoie des francs CFA" }).click();
  await page.getByLabel("Montant envoyé").fill("100 000");
  await page.locator("details.advanced summary").click();
  await page.getByLabel("Mon taux").fill("6559");
  await expect(page.getByText(/Taux hors limites/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Publier ma demande|Échanger maintenant/ })).toBeDisabled();

  await page.getByLabel("Mon taux").fill("660");
  await expect(page.getByText(/indiquez d'abord\s+votre IBAN/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier ma demande" })).toBeDisabled();

  await fillPaymentDetails(page, { iban: EXAMPLE_IBAN });
  await page.goto("/app/echanger");
  await page.getByRole("button", { name: "J'envoie des francs CFA" }).click();
  await page.getByLabel("Montant envoyé").fill("100 000");
  await expect(page.getByRole("button", { name: "Publier ma demande" })).toBeEnabled();
  // Sans offre, MEYA propose le taux officiel.
  await expect(page.getByText(/publiée au taux de 655,957/)).toBeVisible();
});

test("Accueil, Activité et Compte sont trois onglets en bas de l'écran", async ({ page }) => {
  await signUp(page, "onglets");
  // Accueil : le convertisseur ; les onglets sont en bas, même sur ordinateur.
  await expect(page.getByLabel("Montant envoyé")).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(tabs).toHaveCount(1);
  const box = await tabs.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan((page.viewportSize()!.height) - 5);
  await expect(tabs.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Activité" }).click();
  await expect(page).toHaveURL(/\/app\/activite$/);
  await expect(page.getByRole("heading", { name: "Mes limites" })).toBeVisible();
  await expect(page.getByText("0 / 2 000 000 XOF").first()).toBeVisible();
  await expect(page.getByLabel("Montant envoyé")).toHaveCount(0);
  // Les anciennes adresses redirigent.
  await page.goto("/app/echanger");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/ordres");
  await expect(page).toHaveURL(/\/app\/activite$/);
});

test("depuis Activité, choisir une offre ouvre le convertisseur prérempli et conclut l'échange", async ({ browser }) => {
  test.setTimeout(60_000);
  const maker = await (await browser.newContext()).newPage();
  const taker = await (await browser.newContext()).newPage();
  await signUp(maker, "offre-a");
  await fillPaymentDetails(maker, { phone: "+221 77 000 00 08", phoneHolder: "Awa Test" });
  await placeOrder(maker, { direction: "EUR → XOF", amount: "100", rate: "655" });

  await signUp(taker, "offre-b");
  await fillPaymentDetails(taker, { iban: EXAMPLE_IBAN, ibanHolder: "Jean Test" });
  await taker.goto("/app/activite");
  await expect(taker.getByText("100,00 € disponibles")).toBeVisible();
  await taker.getByRole("link", { name: /Envoyer 65\s500 XOF/ }).click();
  await expect(taker).toHaveURL(/\/app\?sens=SELL_XOF/);
  await expect(taker.getByLabel("Montant envoyé")).toHaveValue(/65\s500/);
  await expect(taker.getByLabel("Mon taux")).toHaveValue("655");
  await expect(taker.getByLabel("Montant reçu")).toHaveText("100,00");
  await taker.getByRole("button", { name: "Échanger maintenant" }).click();
  await expect(taker).toHaveURL(/\/app\/ordres\//);
  await expect(taker.getByText("1 partenaire a été trouvé tout de suite.")).toBeVisible();
});

test("la cloche signale les notifications, puis les marque comme lues", async ({ browser }) => {
  test.setTimeout(60_000);
  const maker = await (await browser.newContext()).newPage();
  const taker = await (await browser.newContext()).newPage();
  await signUp(maker, "cloche-a");
  await fillPaymentDetails(maker, { phone: "+221 77 000 00 05", phoneHolder: "Awa Test" });
  await placeOrder(maker, { direction: "EUR → XOF", amount: "100", rate: "660" });
  await signUp(taker, "cloche-b");
  await fillPaymentDetails(taker, { iban: EXAMPLE_IBAN, ibanHolder: "Jean Test" });
  await placeOrder(taker, { direction: "XOF → EUR", amount: "66 000", rate: "670" });

  await maker.goto("/app");
  const bell = maker.getByRole("link", { name: /Notifications : 1 non lue/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(maker.getByText("Un partenaire a accepté votre demande")).toBeVisible();
  await expect(maker.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
});

test("propose de n'échanger que la partie disponible", async ({ browser }) => {
  test.setTimeout(60_000);
  const maker = await (await browser.newContext()).newPage();
  const taker = await (await browser.newContext()).newPage();
  await signUp(maker, "partiel-a");
  await fillPaymentDetails(maker, { phone: "+221 77 000 00 06", phoneHolder: "Awa Test" });
  await placeOrder(maker, { direction: "EUR → XOF", amount: "100", rate: "655" });

  await signUp(taker, "partiel-b");
  await fillPaymentDetails(taker, { iban: EXAMPLE_IBAN, ibanHolder: "Jean Test" });
  await taker.goto("/app");
  await taker.getByRole("button", { name: "J'envoie des francs CFA" }).click();
  await taker.getByLabel("Montant envoyé").fill("100 000");
  await expect(taker.getByText("Il n'y a pas de partenaire pour tout le montant.")).toBeVisible();
  await taker.getByRole("radio", { name: /Seulement la partie disponible/ }).check();
  await taker.getByRole("button", { name: /Échanger 65\s500 XOF maintenant/ }).click();
  await expect(taker).toHaveURL(/\/app\/ordres\//);
  await expect(taker.getByText("Servi", { exact: true })).toBeVisible();
  await expect(taker.getByText(/Vous envoyez\s*65\s500 XOF/)).toBeVisible();
});

test("la console super admin est réservée, et une suspension y est appliquée", async ({ browser }) => {
  test.setTimeout(60_000);
  const userPage = await (await browser.newContext()).newPage();
  const user = await signUp(userPage, "suspendu");
  await userPage.goto("/admin");
  await expect(userPage).toHaveURL(/\/app$/);

  const adminPage = await (await browser.newContext()).newPage();
  const admin = await signUp(adminPage, "superadmin");
  await grantAdmin(admin.email);
  await adminPage.goto("/app");
  await adminPage.getByRole("link", { name: "Admin" }).click();
  await expect(adminPage.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();

  await adminPage.goto(`/admin/utilisateurs?q=${encodeURIComponent(user.email)}`);
  await adminPage.getByRole("button", { name: "Suspendre" }).click();
  await adminPage.getByLabel("Motif de la suspension").fill("Vérification en cours");
  await adminPage.getByRole("button", { name: "Confirmer la suspension" }).click();
  await expect(adminPage.getByText("Compte suspendu.")).toBeVisible();

  await userPage.goto("/app");
  await expect(userPage.getByText("Votre compte est suspendu.")).toBeVisible();
  await adminPage.goto("/admin/audit");
  await expect(adminPage.getByRole("cell", { name: "Compte suspendu" })).toBeVisible();
});

test("l'écran d'ouverture apparaît à la première visite, puis plus pendant la visite", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".splash")).toBeAttached();
  await expect(page.locator("html")).not.toHaveClass(/no-splash/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/no-splash/);
});

test("le convertisseur affiche et applique les plafonds", async ({ page }) => {
  await signUp(page, "plafonds");
  await page.goto("/app/echanger");
  await expect(page.getByText(/Vous pouvez encore échanger 2\s000\s000 XOF aujourd'hui/)).toBeVisible();
  await page.getByRole("button", { name: "J'envoie des francs CFA" }).click();
  await page.getByLabel("Montant envoyé").fill("2 000 001");
  await expect(page.getByText(/Montant trop élevé : 2\s000\s000 XOF au plus par échange/)).toBeVisible();
  await page.getByRole("button", { name: "J'envoie des euros" }).click();
  await page.getByLabel("Montant envoyé").fill("3 100");
  await expect(page.getByText(/Montant trop élevé/)).toBeVisible();
});

test("l'introduction s'affiche au premier lancement, puis plus jamais", async ({ page }) => {
  await signUp(page, "intro", { intro: true });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Bienvenue sur MEYA" })).toBeVisible();
  await dialog.getByRole("button", { name: "Suivant" }).click();
  await dialog.getByRole("button", { name: "Suivant" }).click();
  await expect(dialog.getByRole("heading", { name: "Vous vous payez, MEYA vous guide" })).toBeVisible();
  await dialog.getByRole("button", { name: "Commencer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
