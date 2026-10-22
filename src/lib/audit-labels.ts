/** Libellés lisibles des actions du journal d'audit. */
const LABELS: Record<string, string> = {
  "user.signed_up": "Inscription",
  "user.signed_in": "Connexion",
  "user.sign_in_failed": "Échec de connexion",
  "user.signed_out": "Déconnexion",
  "user.suspended": "Compte suspendu",
  "user.reactivated": "Compte réactivé",
  "order.placed": "Demande créée",
  "order.cancelled": "Demande annulée",
  "order.cancelled_by_admin": "Demande annulée par l'admin",
  "payment_details.updated": "Coordonnées modifiées",
  "settlement.taker_sent": "Paiement envoyé (premier)",
  "settlement.maker_received": "Réception confirmée (premier)",
  "settlement.maker_sent": "Paiement envoyé (second)",
  "settlement.taker_received": "Réception confirmée : réglé",
  "dispute.opened": "Litige signalé",
  "dispute.resolved": "Litige tranché",
  "invite.added": "Invitation ajoutée",
  "invite.removed": "Invitation retirée",
  "admin.role_granted": "Rôle super admin accordé",
};

export function actionLabel(action: string): string {
  return LABELS[action] ?? action;
}

/** Catégories proposées comme filtre dans le centre d'audit. */
export const AUDIT_FILTERS = [
  { value: "", label: "Tout" },
  { value: "user.", label: "Comptes et connexions" },
  { value: "order.", label: "Demandes" },
  { value: "settlement.", label: "Règlements" },
  { value: "dispute.", label: "Litiges" },
  { value: "invite.", label: "Invitations" },
  { value: "admin.", label: "Administration" },
] as const;
