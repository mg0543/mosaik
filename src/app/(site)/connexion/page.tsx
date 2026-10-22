import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthTabs } from "@/components/auth-tabs";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  lien: "Ce lien est invalide ou a expiré. Connectez-vous avec votre mot de passe.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { erreur } = await searchParams;

  return (
    <div className="auth-page">
      <section className="card auth-card">
        <div className="card-body">
          <AuthTabs active="connexion" />
          <h1 className="auth-title">Connexion</h1>
          <p className="muted" style={{ marginTop: 0 }}>Content de vous revoir.</p>
          <LoginForm initialError={erreur ? ERRORS[erreur] : undefined} />
        </div>
      </section>
    </div>
  );
}
