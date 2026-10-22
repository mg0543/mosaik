/** Statut d'un ordre tel qu'affiché à son auteur. */
export type StatusTone = "open" | "partial" | "done" | "off";

export function orderStatus(order: {
  status: "open" | "filled" | "cancelled";
  given: number;
}): { label: string; tone: StatusTone } {
  if (order.status === "filled") return { label: "Servi", tone: "done" };
  if (order.status === "cancelled") return { label: order.given > 0 ? "Annulé, servi en partie" : "Annulé", tone: "off" };
  return order.given > 0 ? { label: "Servi en partie", tone: "partial" } : { label: "En attente d'un partenaire", tone: "open" };
}
