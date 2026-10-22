import { LocalDate } from "@/components/local-date";
import { listUsers } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";
import { reactivateUserAction, suspendUserAction } from "../actions";
import { AdminForm } from "../forms";

export const metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const { q } = await searchParams;
  const users = await listUsers(getSql(), { search: q });

  return (
    <div className="admin-page">
      <h1 className="app-title">Utilisateurs ({users.length})</h1>
      <form className="admin-search" role="search">
        <input name="q" defaultValue={q} placeholder="Rechercher par nom ou e-mail" aria-label="Rechercher un utilisateur" className="admin-input" />
        <button type="submit" className="btn btn-secondary btn-sm">Rechercher</button>
      </form>
      <ul className="admin-list">
        {users.map((u) => (
          <li key={u.id} className="admin-row">
            <div className="admin-row-main">
              <strong>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "Sans nom"}</strong>
              {u.isAdmin && <span className="chip chip-done">super admin</span>}
              {u.suspendedAt && <span className="chip chip-late">suspendu</span>}
              <span className="muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
              <span className="muted admin-meta">
                Inscrit le <LocalDate date={u.createdAt} /> · dernière connexion{" "}
                {u.lastSignInAt ? <LocalDate date={u.lastSignInAt} /> : "jamais"} · {u.orders} demande{u.orders > 1 ? "s" : ""} ·{" "}
                {u.trades} échange{u.trades > 1 ? "s" : ""}
              </span>
              {u.suspendedReason && <span className="warn-text">Motif : {u.suspendedReason}</span>}
            </div>
            <div className="admin-row-actions">
              {u.id !== admin.id && !u.isAdmin && (u.suspendedAt ? (
                <AdminForm action={reactivateUserAction} hidden={{ userId: u.id }} label="Réactiver" confirm="Réactiver" />
              ) : (
                <AdminForm action={suspendUserAction} hidden={{ userId: u.id }} label="Confirmer la suspension" danger
                  confirm="Suspendre" reasonLabel="Motif de la suspension" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
