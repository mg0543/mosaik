import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("sur mobile, la barre d'onglets remplace la navigation et rien ne déborde", async ({ page }) => {
  await signUp(page, "mobile");

  const tabbar = page.getByRole("navigation", { name: "Navigation principale" }).last();
  await expect(tabbar).toBeVisible();
  await tabbar.getByRole("link", { name: "Activité" }).click();
  await expect(page).toHaveURL(/\/app\/activite$/);
  await expect(tabbar.getByRole("link", { name: "Activité" })).toHaveAttribute("aria-current", "page");

  for (const path of ["/", "/connexion", "/inscription", "/app", "/app/activite", "/app/notifications", "/app/compte", "/simulateur"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `débordement horizontal sur ${path}`).toBeLessThanOrEqual(0);
  }
});

test("l'application est installable : manifeste et icônes valides", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "MEYA", display: "standalone", start_url: "/app" });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/apple-icon")).status()).toBe(200);
});
