import { describe, expect, it } from "vitest";
import { orderStatus } from "./order-status";

describe("orderStatus", () => {
  it("distingue en attente, partiellement servi, servi et annulé", () => {
    expect(orderStatus({ status: "open", given: 0 })).toEqual({ label: "En attente", tone: "open" });
    expect(orderStatus({ status: "open", given: 10 })).toEqual({ label: "Partiellement servi", tone: "partial" });
    expect(orderStatus({ status: "filled", given: 10 })).toEqual({ label: "Servi", tone: "done" });
    expect(orderStatus({ status: "cancelled", given: 0 })).toEqual({ label: "Annulé", tone: "off" });
    expect(orderStatus({ status: "cancelled", given: 10 })).toEqual({ label: "Annulé, servi en partie", tone: "off" });
  });
});
