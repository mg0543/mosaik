import { redirect } from "next/navigation";

/** L'écran d'échange est désormais l'onglet Envoyer, à l'accueil de l'espace. */
export default function ExchangeRedirect() {
  redirect("/app");
}
