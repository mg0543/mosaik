import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getBookForUser } from "@/server/queries";
import { ExchangeForm } from "./exchange-form";

export const metadata: Metadata = { title: "Échanger" };

export default async function ExchangePage() {
  const user = await requireUser();
  const book = await getBookForUser(getSql(), user.id);

  return (
    <div className="app-page">
      <h1 className="app-title">Nouvel échange</h1>
      <ExchangeForm book={book} />
    </div>
  );
}
