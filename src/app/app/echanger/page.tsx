import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { payToFor } from "@/lib/payment";
import { getBookForUser } from "@/server/queries";
import { getPaymentDetails } from "@/server/settlements";
import { ExchangeForm } from "./exchange-form";

export const metadata: Metadata = { title: "Échanger" };

export default async function ExchangePage() {
  const user = await requireUser();
  const sql = getSql();
  const [book, details] = await Promise.all([getBookForUser(sql, user.id), getPaymentDetails(sql, user.id)]);
  // Pour passer un ordre, il faut pouvoir être payé dans la devise reçue.
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };

  return (
    <div className="app-page">
      <h1 className="app-title">Nouvel échange</h1>
      <ExchangeForm book={book} canReceive={canReceive} />
    </div>
  );
}
