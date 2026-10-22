import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(site)/connexion/actions";
import { MAX_OPEN_ORDERS, MAX_ORDER_XOF, RATE_BAND_PCT } from "@/lib/policy";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getProfile } from "@/server/profiles";
import { getPaymentDetails } from "@/server/settlements";
import { PaymentForms } from "./payment-forms";

export const metadata: Metadata = { title: "Compte" };

export default async function AccountPage() {
  const user = await requireUser();
  const sql = getSql();
  const [details, profile] = await Promise.all([getPaymentDetails(sql, user.id), getProfile(sql, user.id)]);
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  return (
    <div className="app-page">
      <h1 className="app-title">Compte</h1>

      <section className="card">
        <div className="card-body">
          <dl className="facts">
            {fullName && <div><dt>Nom</dt><dd>{fullName}</dd></div>}
            <div><dt>Adresse e-mail</dt><dd>{user.email}</dd></div>
            <div><dt>Téléphone</dt><dd>{profile.phone ?? "Non renseigné"}</dd></div>
            <div><dt>E-mail et téléphone visibles par les autres</dt><dd>Jamais</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="details-title" className="app-page">
        <div>
          <h2 id="details-title" className="section-title" style={{ marginBottom: 4 }}>Coordonnées de réception</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            C&apos;est là que vos contreparties vous paieront. Elles ne sont communiquées qu&apos;aux personnes
            avec qui vous échangez, pour cet échange seulement, et restent figées pour chaque échange déjà conclu.
          </p>
        </div>
        <PaymentForms details={details} />
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="section-title" style={{ marginTop: 0 }}>Règles du pilote</h2>
          <ul className="plain-list">
            <li>Montant maximal par ordre : {MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF ou l&apos;équivalent en euros.</li>
            <li>Au plus {MAX_OPEN_ORDERS} ordres en attente à la fois.</li>
            <li>Taux limite compris à ±{RATE_BAND_PCT} % du taux de référence, pour éviter les fautes de frappe.</li>
            <li>Vous payez et êtes payé directement par vos contreparties ; aucun argent ne transite par Mosaik.</li>
          </ul>
        </div>
      </section>

      <p className="field-hint">
        <Link href="/conditions">Conditions du pilote</Link> · <Link href="/confidentialite">Confidentialité</Link>
      </p>

      <form action={signOutAction}>
        <button type="submit" className="btn btn-secondary btn-block">Se déconnecter</button>
      </form>
    </div>
  );
}
