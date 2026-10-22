import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <div className="auth-page">
      <section className="card auth-card">
        <div className="card-body">
          <h1 className="auth-title">Mot de passe oublié</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Recevez un code par e-mail, puis choisissez un nouveau mot de passe.
          </p>
          <ResetForm />
        </div>
      </section>
    </div>
  );
}
