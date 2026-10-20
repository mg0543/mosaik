import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(site)/connexion/actions";
import { MAX_ORDER_XOF, RATE_BAND_PCT } from "@/lib/policy";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Compte" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="app-page">
      <h1 className="app-title">Compte</h1>

      <section className="card">
        <div className="card-body">
          <dl className="facts">
            <div><dt>Adresse e-mail</dt><dd>{user.email}</dd></div>
            <div><dt>Visible par les autres participants</dt><dd>Non, jamais</dd></div>
          </dl>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="section-title" style={{ marginTop: 0 }}>Règles du pilote</h2>
          <ul className="plain-list">
            <li>Montant maximal par ordre : {MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF ou l&apos;équivalent en euros.</li>
            <li>Taux limite compris à ±{RATE_BAND_PCT} % du taux de référence, pour éviter les fautes de frappe.</li>
            <li>Mosaik calcule et enregistre les appariements ; aucun argent ne transite par la plateforme.</li>
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
