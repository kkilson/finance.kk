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

  it("con 0% de inicial se financia todo (caso Cashea sin inicial)", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 90,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
    });
    expect(plan.inicial).toBe(0);
    expect(plan.financiado).toBe(90);
    expect(plan.cuotas.map((c) => c.monto)).toEqual([30, 30, 30]);
    expect(plan.saldoRestante).toBe(90);
  });

  it("descuenta las cuotas ya pagadas del saldo y de lo pendiente", () => {
    // Registro la deuda cuando ya pagué 2 de 3: solo debo la última.
    const plan = generarCuotasBnpl({
      montoOriginal: 90,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
      cuotasPagadas: 2,
    });
    expect(plan.pagadas.map((c) => c.numero)).toEqual([1, 2]);
    expect(plan.pendientes.map((c) => c.numero)).toEqual([3]);
    expect(plan.saldoRestante).toBe(30);
  });

  it("con todas las cuotas pagadas el saldo queda en cero", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 90,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
      cuotasPagadas: 3,
    });
    expect(plan.pendientes).toEqual([]);
    expect(plan.saldoRestante).toBe(0);
  });

  it("no se pasa aunque le digan más cuotas pagadas que las que hay", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 90,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
      cuotasPagadas: 99,
    });
    expect(plan.pagadas).toHaveLength(3);
    expect(plan.saldoRestante).toBe(0);
  });

  it("el saldo respeta el ajuste de redondeo de la última cuota", () => {
    // 100 en 3 cuotas: 33.33 / 33.33 / 33.34. Pagadas 2 -> queda 33.34.
    const plan = generarCuotasBnpl({
      montoOriginal: 100,
      pctInicial: 0,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
      cuotasPagadas: 2,
    });
    expect(plan.saldoRestante).toBe(33.34);
  });

  it("combina inicial y cuotas pagadas (40% y 1 de 3)", () => {
    const plan = generarCuotasBnpl({
      montoOriginal: 100,
      pctInicial: 40,
      numeroCuotas: 3,
      frecuenciaCuota: "QUINCENAL",
      fechaCompra: COMPRA,
      cuotasPagadas: 1,
    });
    expect(plan.inicial).toBe(40);
    expect(plan.financiado).toBe(60);
    expect(plan.saldoRestante).toBe(40); // 60 - 20 ya pagada
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
