import { describe, expect, it } from "vitest";
import {
  computarCapacidadEndeudamiento,
  costoMensualDeuda,
  FACTOR_QUINCENAL,
  type DeudaParaCapacidad,
  type EntradaCapacidad,
} from "./capacidad-endeudamiento";

function deuda(over: Partial<DeudaParaCapacidad> = {}): DeudaParaCapacidad {
  return {
    nombre: "Deuda",
    tipo: "PRESTAMO_CUOTAS",
    saldoRestante: 100,
    montoOriginal: 120,
    pagoMinimoMensual: null,
    numeroCuotas: 6,
    frecuenciaCuota: "MENSUAL",
    ...over,
  };
}

function entrada(over: Partial<EntradaCapacidad> = {}): EntradaCapacidad {
  return {
    ingresosFijos3Meses: [500, 500, 500],
    deudas: [],
    umbralEndeudamiento: 0.35,
    pctPagoMinimoTarjeta: 0.1,
    monedaReferencia: "USD",
    ...over,
  };
}

describe("costoMensualDeuda", () => {
  it("tarjeta sin pago mínimo registrado usa el % configurado del saldo", () => {
    expect(costoMensualDeuda(deuda({ tipo: "TARJETA", saldoRestante: 410 }), 0.1)).toBe(41);
  });

  it("un pago mínimo explícito gana sobre la estimación", () => {
    expect(
      costoMensualDeuda(deuda({ tipo: "TARJETA", saldoRestante: 410, pagoMinimoMensual: 120 }), 0.1),
    ).toBe(120);
  });

  it("préstamo en cuotas mensuales reparte el monto original", () => {
    expect(costoMensualDeuda(deuda({ montoOriginal: 120, numeroCuotas: 6 }), 0.1)).toBe(20);
  });

  it("las cuotas quincenales se llevan a equivalente mensual", () => {
    const c = costoMensualDeuda(
      deuda({ tipo: "BNPL", montoOriginal: 120, numeroCuotas: 6, frecuenciaCuota: "QUINCENAL" }),
      0.1,
    );
    expect(c).toBe(Number((20 * FACTOR_QUINCENAL).toFixed(2)));
  });

  it("un préstamo informal sin cuota pactada no aporta compromiso mensual", () => {
    expect(costoMensualDeuda(deuda({ tipo: "PRESTAMO_INFORMAL" }), 0.1)).toBe(0);
  });

  it("un préstamo en cuotas sin número de cuotas no rompe el cálculo", () => {
    expect(costoMensualDeuda(deuda({ numeroCuotas: null }), 0.1)).toBe(0);
  });
});

describe("computarCapacidadEndeudamiento", () => {
  it("promedia el ingreso fijo sobre 3 meses", () => {
    const r = computarCapacidadEndeudamiento(entrada({ ingresosFijos3Meses: [600, 600, 600] }));
    expect(r.ingresoFijoMensual).toBe(600);
  });

  it("calcula ratio y capacidad disponible contra el umbral", () => {
    const r = computarCapacidadEndeudamiento(
      entrada({ deudas: [deuda({ montoOriginal: 120, numeroCuotas: 6 })] }), // 20/mes
    );
    expect(r.compromisosDeudaActuales).toBe(20);
    expect(r.ratioEndeudamientoActual).toBeCloseTo(20 / 500, 4);
    expect(r.capacidadDisponible).toBe(155); // 500*0.35 - 20
    expect(r.estado).toBe("disponible");
  });

  it("marca en_limite al acercarse al umbral", () => {
    const r = computarCapacidadEndeudamiento(
      entrada({ deudas: [deuda({ pagoMinimoMensual: 150 })] }), // ratio 0.30 vs umbral 0.35
    );
    expect(r.estado).toBe("en_limite");
  });

  it("marca excedido y nunca muestra capacidad negativa", () => {
    const r = computarCapacidadEndeudamiento(
      entrada({ deudas: [deuda({ pagoMinimoMensual: 300 })] }),
    );
    expect(r.estado).toBe("excedido");
    expect(r.capacidadDisponible).toBe(0);
  });

  it("sin ingreso fijo registrado no inventa un ratio", () => {
    const r = computarCapacidadEndeudamiento(
      entrada({ ingresosFijos3Meses: [], deudas: [deuda({ pagoMinimoMensual: 50 })] }),
    );
    expect(r.estado).toBe("sin_datos");
    expect(r.ratioEndeudamientoActual).toBe(0);
    expect(Number.isFinite(r.capacidadDisponible)).toBe(true);
  });

  it("devuelve el desglose por deuda", () => {
    const r = computarCapacidadEndeudamiento(
      entrada({
        deudas: [
          deuda({ nombre: "Tarjeta", tipo: "TARJETA", saldoRestante: 400 }),
          deuda({ nombre: "Cashea", montoOriginal: 60, numeroCuotas: 3 }),
        ],
      }),
    );
    expect(r.detalle).toEqual([
      { nombre: "Tarjeta", costoMensual: 40 },
      { nombre: "Cashea", costoMensual: 20 },
    ]);
  });
});
