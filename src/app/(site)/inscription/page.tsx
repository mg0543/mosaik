import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthTabs } from "@/components/auth-tabs";
import { getCurrentUser } from "@/server/auth";
import { isInviteOnly } from "@/server/config";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/app");

  return (
    <div className="auth-page">
      <section className="card auth-card">
        <div className="card-body">
          <AuthTabs active="inscription" />
          <h1 className="auth-title">Créer un compte</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {isInviteOnly()
              ? "Le pilote est sur invitation : utilisez l'adresse e-mail à laquelle vous avez été invité."
              : "Quelques informations pour commencer."}
          </p>
          <SignUpForm />
        </div>
      </section>
    </div>
  );
}
