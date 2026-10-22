import { redirect } from "next/navigation";

/** La liste des échanges fait désormais partie de l'onglet Activité. */
export default function OrdersRedirect() {
  redirect("/app/activite");
}
