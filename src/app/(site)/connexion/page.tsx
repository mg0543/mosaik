import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  lien: "Ce lien de connexion est invalide ou a expiré. Demandez un nouveau code.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { erreur } = await searchParams;

  return (
    <div className="auth-page">
      <section className="card auth-card">
        <div className="card-body">
          <h1 className="auth-title">Connexion</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Saisissez votre adresse e-mail. Si vous n&apos;avez pas encore de compte, il sera créé.
          </p>
          <LoginForm initialError={erreur ? ERRORS[erreur] : undefined} />
        </div>
      </section>
    </div>
  );
}
