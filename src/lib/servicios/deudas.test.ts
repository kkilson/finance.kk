import { describe, expect, it } from "vitest";
import { fechaDeCuota, generarCuotasBnpl } from "./deudas";

const COMPRA = new Date("2026-08-14T00:00:00Z");

describe("fechaDeCuota", () => {
  it("quincenal avanza de 14 en 14 días", () => {
    expect(fechaDeCuota(COMPRA, 1, "QUINCENAL").toISOString().slice(0, 10)).toBe("2026-08-28");
    expect(fechaDeCuota(COMPRA, 2, "QUINCENAL").toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("mensual avanza de mes en mes", () => {
    expect(fechaDeCuota(COMPRA, 1, "MENSUAL").toISOString().slice(0, 10)).toBe("2026-09-14");
  });
});

describe("generarCuotasBnpl", () => {
  it("descuenta la inicial y reparte el resto (caso Cashea 40% en 3 cuotas)", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 100,
      pctInicial: 40,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
    });
    expect(plan.inicial).toBe(40);
    expect(plan.financiado).toBe(60);
    expect(plan.cuotas.map((c) => c.monto)).toEqual([20, 20, 20]);
  });

  it("la suma de las cuotas siempre iguala lo financiado, aunque no divida exacto", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 100,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
    });
    const suma = plan.cuotas.reduce((a, c) => a + c.monto, 0);
    expect(Number(suma.toFixed(2))).toBe(100);
    expect(plan.cuotas.map((c) => c.monto)).toEqual([33.33, 33.33, 33.34]);
  });

  it("sin inicial, se financia el monto completo", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 240,
      pctInicial: null,
      numeroCuotas: 6,
      frecuenciaCuota: "MENSUAL",
      fechaCompra: COMPRA,
    });
    expect(plan.inicial).toBe(0);
    expect(plan.financiado).toBe(240);
    expect(plan.cuotas).toHaveLength(6);
    expect(plan.cuotas[5].fecha.toISOString().slice(0, 10)).toBe("2027-02-14");
  });

  it("numera las cuotas desde 1", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 50,
      pctInicial: 0,
      numeroCuotas: 2,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
    });
    expect(plan.cuotas.map((c) => c.numero)).toEqual([1, 2]);
  });
});
