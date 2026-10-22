import type { Metadata } from "next";
import Link from "next/link";
import { Converter } from "@/components/converter";
import { payToFor } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getVolumeUsage } from "@/server/orders";
import { getProfile } from "@/server/profiles";
import { getBookForUser } from "@/server/queries";
import { getPaymentDetails, getPendingActions } from "@/server/settlements";

export const metadata: Metadata = { title: "Envoyer" };

/** Onglet Envoyer : le convertisseur, comme écran principal de l'application. */
export default async function SendPage() {
  const user = await requireUser();
  const sql = getSql();
  const [book, details, usage, profile, toDo] = await Promise.all([
    getBookForUser(sql, user.id),
    getPaymentDetails(sql, user.id),
    getVolumeUsage(sql, user.id),
    getProfile(sql, user.id),
    getPendingActions(sql, user.id),
  ]);
  // Pour échanger, il faut pouvoir être payé dans la devise reçue.
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };

  return (
    <div className="app-page">
      <div>
        <h1 className="app-title">Bonjour{profile.firstName ? ` ${profile.firstName}` : ""} 👋</h1>
        <p className="muted app-subtitle-plain">Combien voulez-vous envoyer ?</p>
      </div>

      {toDo.length > 0 && (
        <Link href="/app/activite" className="action-banner">
          <span className="action-dot" aria-hidden="true" />
          <span>
            <strong>{toDo.length} paiement{toDo.length > 1 ? "s attendent" : " attend"} votre action</strong> dans
            Activité.
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section className="card converter-card" aria-label="Nouvel échange">
        <div className="card-body">
          <Converter book={book} mode="app" canReceive={canReceive} usage={usage} />
        </div>
      </section>
    </div>
  );
}
