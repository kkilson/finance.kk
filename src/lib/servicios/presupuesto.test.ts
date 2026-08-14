import { describe, expect, it } from "vitest";
import { trasladarFecha } from "./presupuesto";

describe("trasladarFecha", () => {
  it("conserva el mismo día del mes", () => {
    expect(trasladarFecha(new Date(2026, 7, 16), "2026-09")).toEqual(new Date(2026, 8, 16));
  });

  it("cae al último día si el destino es más corto", () => {
    expect(trasladarFecha(new Date(2026, 0, 31), "2026-02")).toEqual(new Date(2026, 1, 28));
  });

  it("respeta los años bisiestos", () => {
    expect(trasladarFecha(new Date(2028, 0, 31), "2028-02")).toEqual(new Date(2028, 1, 29));
  });

  it("sirve también para saltar de año", () => {
    expect(trasladarFecha(new Date(2026, 11, 5), "2027-01")).toEqual(new Date(2027, 0, 5));
  });
});
