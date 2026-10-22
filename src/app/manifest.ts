import type { MetadataRoute } from "next";

/** Manifeste PWA : rend MEYA installable sur l'écran d'accueil du téléphone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEYA · Échange EUR ↔ XOF",
    short_name: "MEYA",
    description: "Échangez vos euros et vos francs CFA entre particuliers, chacun à son prix.",
    lang: "fr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f3ef",
    theme_color: "#00856a",
    categories: ["finance"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
