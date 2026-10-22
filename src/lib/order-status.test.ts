import { describe, expect, it } from "vitest";
import { orderStatus } from "./order-status";

describe("orderStatus", () => {
  it("distingue en attente, partiellement servi, servi et annulé", () => {
    expect(orderStatus({ status: "open", given: 0 })).toEqual({ label: "En attente d'un partenaire", tone: "open" });
    expect(orderStatus({ status: "open", given: 10 })).toEqual({ label: "Servi en partie", tone: "partial" });
    expect(orderStatus({ status: "filled", given: 10 })).toEqual({ label: "Servi", tone: "done" });
    expect(orderStatus({ status: "cancelled", given: 0 })).toEqual({ label: "Annulé", tone: "off" });
    expect(orderStatus({ status: "cancelled", given: 10 })).toEqual({ label: "Annulé, servi en partie", tone: "off" });
  });
});
