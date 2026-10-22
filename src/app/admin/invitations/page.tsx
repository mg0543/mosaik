import { LocalDate } from "@/components/local-date";
import { listInvites } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { isInviteOnly } from "@/server/config";
import { getSql } from "@/server/db";
import { addInviteAction, removeInviteAction } from "../actions";
import { AdminForm } from "../forms";

export const metadata = { title: "Invitations" };

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = await listInvites(getSql());

  return (
    <div className="admin-page">
      <h1 className="app-title">Invitations ({invites.length})</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {isInviteOnly()
          ? "L'inscription est réservée aux adresses invitées."
          : "L'inscription est actuellement ouverte à tous : les invitations ne sont pas nécessaires."}
      </p>
      <section className="card">
        <div className="card-body">
          <AdminForm action={addInviteAction} hidden={{}} label="Inviter">
            <input name="email" type="email" required placeholder="adresse@exemple.com" aria-label="Adresse à inviter" className="admin-input" />
            <input name="note" placeholder="Note (facultatif)" aria-label="Note" className="admin-input" />
          </AdminForm>
        </div>
      </section>
      <ul className="admin-list">
        {invites.map((i) => (
          <li key={i.email} className="admin-row">
            <div className="admin-row-main">
              <strong>{i.email}</strong>
              {i.registered ? <span className="chip chip-done">inscrit</span> : <span className="chip chip-open">en attente</span>}
              <span className="muted admin-meta">Invité le <LocalDate date={i.invitedAt} />{i.note ? ` · ${i.note}` : ""}</span>
            </div>
            <div className="admin-row-actions">
              <AdminForm action={removeInviteAction} hidden={{ email: i.email }} label="Retirer" confirm="Retirer" danger />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
