import { describe, expect, it } from "vitest";
import { addDays, subDays } from "date-fns";
import {
  evaluarReglas,
  type CompromisoSnapshot,
  type ConfigRegla,
  type SnapshotUsuario,
} from "./reglas";

const HOY = new Date(2026, 7, 14, 10, 0); // 14 ago 2026, 10am

function compromiso(over: Partial<CompromisoSnapshot> = {}): CompromisoSnapshot {
  return {
    id: "c1",
    tipo: "PAGO",
    concepto: "Condominio",
    montoFormateado: "$45,00",
    fechaEsperada: addDays(HOY, 2),
    estado: "PENDIENTE",
    esCuotaBnpl: false,
    ...over,
  };
}

function snapshot(over: Partial<SnapshotUsuario> = {}): SnapshotUsuario {
  return {
    hoy: HOY,
    monedaReferencia: "USD",
    compromisos: [],
    tarjetas: [],
    cobertura: null,
    capacidad: null,
    gastoDelMes: 0,
    referenciaMensual: 0,
    gastoFormateado: "$0,00",
    ...over,
  };
}

const SIN_CONFIG: ConfigRegla[] = [];

describe("evaluarReglas", () => {
  it("avisa de un pago dentro de la ventana de anticipación", () => {
    const r = evaluarReglas(snapshot({ compromisos: [compromiso()] }), SIN_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0].regla).toBe("PAGO_POR_VENCER");
    expect(r[0].titulo).toBe("Condominio vence en 2 días");
  });

  it("no avisa de un pago que todavía está lejos", () => {
    const r = evaluarReglas(
      snapshot({ compromisos: [compromiso({ fechaEsperada: addDays(HOY, 10) })] }),
      SIN_CONFIG,
    );
    expect(r).toHaveLength(0);
  });

  it("respeta la anticipación configurada", () => {
    const config: ConfigRegla[] = [
      { regla: "PAGO_POR_VENCER", activa: true, parametro: 7, horaDesde: 0, horaHasta: 23 },
    ];
    const r = evaluarReglas(
      snapshot({ compromisos: [compromiso({ fechaEsperada: addDays(HOY, 6) })] }),
      config,
    );
    expect(r).toHaveLength(1);
  });

  it("una regla desactivada no genera nada", () => {
    const config: ConfigRegla[] = [
      { regla: "PAGO_POR_VENCER", activa: false, parametro: null, horaDesde: 0, horaHasta: 23 },
    ];
    expect(evaluarReglas(snapshot({ compromisos: [compromiso()] }), config)).toHaveLength(0);
  });

  it("fuera de la franja horaria no molesta", () => {
    const config: ConfigRegla[] = [
      { regla: "PAGO_POR_VENCER", activa: true, parametro: null, horaDesde: 20, horaHasta: 23 },
    ];
    expect(evaluarReglas(snapshot({ compromisos: [compromiso()] }), config)).toHaveLength(0);
  });

  it("las cuotas BNPL van por su propia regla y anticipación", () => {
    const s = snapshot({
      compromisos: [
        compromiso({ id: "b1", concepto: "Cashea cuota 1/3", esCuotaBnpl: true }),
      ],
    });
    // Default BNPL = 2 días, y falta exactamente 2.
    const r = evaluarReglas(s, SIN_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0].regla).toBe("CUOTA_BNPL_POR_VENCER");
  });

  it("avisa de un pago atrasado una sola vez al día", () => {
    const s = snapshot({
      compromisos: [
        compromiso({ estado: "ATRASADO", fechaEsperada: subDays(HOY, 3) }),
      ],
    });
    const r = evaluarReglas(s, SIN_CONFIG);
    expect(r.map((h) => h.regla)).toEqual(["PAGO_ATRASADO"]);
    expect(r[0].claveDedup).toBe("PAGO_ATRASADO:c1:2026-08-14");
  });

  it("avisa cuando debería haber llegado un ingreso", () => {
    const s = snapshot({
      compromisos: [
        compromiso({ tipo: "INGRESO_ESPERADO", concepto: "Salario", fechaEsperada: HOY }),
      ],
    });
    const r = evaluarReglas(s, SIN_CONFIG);
    expect(r[0].regla).toBe("INGRESO_ESPERADO_HOY");
    expect(r[0].titulo).toBe("Hoy debería llegarte Salario");
  });

  it("avisa de cobertura en rojo, pero no en verde", () => {
    const rojo = evaluarReglas(
      snapshot({
        cobertura: { estado: "rojo", diasCobertura: 5, diasHastaProximoIngresoFijo: 12 },
      }),
      SIN_CONFIG,
    );
    expect(rojo.map((h) => h.regla)).toEqual(["COBERTURA_EN_ROJO"]);

    const verde = evaluarReglas(
      snapshot({
        cobertura: { estado: "verde", diasCobertura: 40, diasHastaProximoIngresoFijo: 12 },
      }),
      SIN_CONFIG,
    );
    expect(verde).toHaveLength(0);
  });

  it("detecta ritmo de gasto alto contra lo proporcional al día del mes", () => {
    // Día 14 de 31 -> esperado ~45% de 600 = 271; umbral 115% -> 312.
    const s = snapshot({ referenciaMensual: 600, gastoDelMes: 400, gastoFormateado: "$400,00" });
    expect(evaluarReglas(s, SIN_CONFIG).map((h) => h.regla)).toEqual(["RITMO_DE_GASTO_ALTO"]);

    const tranquilo = snapshot({ referenciaMensual: 600, gastoDelMes: 200 });
    expect(evaluarReglas(tranquilo, SIN_CONFIG)).toHaveLength(0);
  });

  it("sin referencia mensual no evalúa el ritmo (evita dividir por cero)", () => {
    const s = snapshot({ referenciaMensual: 0, gastoDelMes: 999 });
    expect(evaluarReglas(s, SIN_CONFIG)).toHaveLength(0);
  });

  it("avisa de tarjetas sobre el umbral y agrupa por tramos de 5%", () => {
    const s = snapshot({
      tarjetas: [
        { nombre: "Mercantil", pctUso: 82, saldoFormateado: "$410", limiteFormateado: "$500" },
        { nombre: "Otra", pctUso: 40, saldoFormateado: "$40", limiteFormateado: "$100" },
      ],
    });
    const r = evaluarReglas(s, SIN_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0].claveDedup).toBe("TARJETA_CERCA_DEL_LIMITE:Mercantil:80");
  });

  it("avisa solo cuando la capacidad está excedida", () => {
    const excedido = evaluarReglas(
      snapshot({
        capacidad: {
          estado: "excedido",
          compromisosFormateado: "$112",
          ingresoFormateado: "$173",
        },
      }),
      SIN_CONFIG,
    );
    expect(excedido.map((h) => h.regla)).toEqual(["CAPACIDAD_EXCEDIDA"]);

    const ok = evaluarReglas(
      snapshot({
        capacidad: { estado: "disponible", compromisosFormateado: "$1", ingresoFormateado: "$100" },
      }),
      SIN_CONFIG,
    );
    expect(ok).toHaveLength(0);
  });

  it("no repite el mismo hecho: la clave de dedup es estable", () => {
    const s = snapshot({ compromisos: [compromiso()] });
    const a = evaluarReglas(s, SIN_CONFIG);
    const b = evaluarReglas(s, SIN_CONFIG);
    expect(a[0].claveDedup).toBe(b[0].claveDedup);
  });
});
