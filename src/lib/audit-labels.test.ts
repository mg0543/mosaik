import { describe, expect, it } from "vitest";
import { actionLabel, AUDIT_FILTERS } from "./audit-labels";

describe("libellés du journal d'audit", () => {
  it("traduit les actions connues et laisse les autres telles quelles", () => {
    expect(actionLabel("order.placed")).toBe("Demande créée");
    expect(actionLabel("user.sign_in_failed")).toBe("Échec de connexion");
    expect(actionLabel("inconnu.action")).toBe("inconnu.action");
  });

  it("propose des filtres par domaine, dont « Tout »", () => {
    expect(AUDIT_FILTERS[0]).toEqual({ value: "", label: "Tout" });
    expect(AUDIT_FILTERS.map((f) => f.value)).toContain("dispute.");
  });
});
