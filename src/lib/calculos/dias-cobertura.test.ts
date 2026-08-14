import { describe, expect, it } from "vitest";
import { subDays } from "date-fns";
import { computarDiasCobertura, type EntradaDiasCobertura } from "./dias-cobertura";

const HOY = new Date("2026-08-14T00:00:00Z");

function entrada(over: Partial<EntradaDiasCobertura> = {}): EntradaDiasCobertura {
  return {
    saldosConvertidos: [1000],
    pagosPendientesConvertidos: [],
    // 30 gastos de 10 -> 300 en 30 días -> 10/día
    gastos: Array.from({ length: 30 }, (_, i) => ({ monto: 10, fecha: subDays(HOY, i) })),
    fechaProximoIngresoFijo: null,
    saldoMinimoSeguridad: 0,
    monedaReferencia: "USD",
    hoy: HOY,
    ...over,
  };
}

describe("computarDiasCobertura", () => {
  it("divide el disponible entre el gasto diario promedio", () => {
    const r = computarDiasCobertura(entrada());
    expect(r.gastoDiarioPromedio).toBe(10);
    expect(r.balanceDisponible).toBe(1000);
    expect(r.diasCobertura).toBe(100);
  });

  it("resta los pagos pendientes y el saldo mínimo de seguridad", () => {
    const r = computarDiasCobertura(
      entrada({ pagosPendientesConvertidos: [200, 100], saldoMinimoSeguridad: 100 }),
    );
    expect(r.balanceDisponible).toBe(600);
    expect(r.diasCobertura).toBe(60);
  });

  it("marca rojo cuando no alcanza hasta el próximo ingreso fijo", () => {
    const r = computarDiasCobertura(
      entrada({
        saldosConvertidos: [50], // 5 días de cobertura
        fechaProximoIngresoFijo: new Date("2026-08-24T00:00:00Z"), // 10 días
      }),
    );
    expect(r.diasHastaProximoIngresoFijo).toBe(10);
    expect(r.diasCobertura).toBe(5);
    expect(r.estado).toBe("rojo");
  });

  it("marca amarillo cuando la holgura es de 1 a 3 días", () => {
    const r = computarDiasCobertura(
      entrada({
        saldosConvertidos: [120], // 12 días
        fechaProximoIngresoFijo: new Date("2026-08-24T00:00:00Z"), // 10 días
      }),
    );
    expect(r.estado).toBe("amarillo");
  });

  it("marca verde cuando sobra más de 3 días de holgura", () => {
    const r = computarDiasCobertura(
      entrada({
        saldosConvertidos: [300], // 30 días
        fechaProximoIngresoFijo: new Date("2026-08-24T00:00:00Z"), // 10 días
      }),
    );
    expect(r.estado).toBe("verde");
  });

  it("sin ingreso fijo a la vista, solo distingue si alcanza o no", () => {
    expect(computarDiasCobertura(entrada()).estado).toBe("verde");
    expect(computarDiasCobertura(entrada({ saldosConvertidos: [0] })).estado).toBe("rojo");
  });

  it("no divide por cero cuando no hay historia suficiente", () => {
    const r = computarDiasCobertura(entrada({ gastos: [] }));
    expect(r.estado).toBe("sin_datos");
    expect(r.gastoDiarioPromedio).toBe(0);
    expect(Number.isFinite(r.diasCobertura)).toBe(true);
  });

  it("con menos de 5 gastos y ninguno en la ventana, reporta sin datos", () => {
    const gastos = [
      { monto: 10, fecha: subDays(HOY, 40) },
      { monto: 10, fecha: subDays(HOY, 45) },
    ];
    expect(computarDiasCobertura(entrada({ gastos })).estado).toBe("sin_datos");
  });

  it("con 5 o más gastos viejos estima el promedio sobre el rango real", () => {
    // 5 gastos de 20 repartidos entre hace 40 y hace 60 días -> 100 / 60 días
    const gastos = [40, 45, 50, 55, 60].map((d) => ({ monto: 20, fecha: subDays(HOY, d) }));
    const r = computarDiasCobertura(entrada({ gastos }));
    expect(r.promedioEstimado).toBe(true);
    expect(r.gastoDiarioPromedio).toBeCloseTo(100 / 60, 2);
  });

  it("un balance negativo da cobertura negativa, no NaN", () => {
    const r = computarDiasCobertura(
      entrada({ saldosConvertidos: [100], pagosPendientesConvertidos: [500] }),
    );
    expect(r.balanceDisponible).toBe(-400);
    expect(r.diasCobertura).toBe(-40);
    expect(r.estado).toBe("rojo");
  });
});
