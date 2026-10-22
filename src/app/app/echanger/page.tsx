import type { Metadata } from "next";
import { Converter } from "@/components/converter";
import { StepIcon } from "@/components/illustrations";
import { payToFor } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getBookForUser } from "@/server/queries";
import { getPaymentDetails } from "@/server/settlements";

export const metadata: Metadata = { title: "Échanger" };

export default async function ExchangePage() {
  const user = await requireUser();
  const sql = getSql();
  const [book, details] = await Promise.all([getBookForUser(sql, user.id), getPaymentDetails(sql, user.id)]);
  // Pour échanger, il faut pouvoir être payé dans la devise reçue.
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };

  return (
    <div className="app-page">
      <h1 className="app-title">Échanger</h1>
      <section className="card converter-card">
        <div className="card-body">
          <Converter book={book} mode="app" canReceive={canReceive} />
        </div>
      </section>
      <section className="card">
        <div className="card-body after-steps">
          <h2 className="section-title" style={{ marginTop: 0 }}>Et ensuite ?</h2>
          <ol className="mini-steps">
            <li><StepIcon name="match" /><span>MEYA vous met en relation avec un ou plusieurs partenaires.</span></li>
            <li><StepIcon name="amount" /><span>Vous voyez exactement combien envoyer, et à qui.</span></li>
            <li><StepIcon name="settle" /><span>Chacun confirme l&apos;envoi puis la réception, dans les 24 heures.</span></li>
          </ol>
        </div>
      </section>
    </div>
  );
}
