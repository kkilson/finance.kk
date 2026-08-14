import { subMonths } from "date-fns";
import type { FrecuenciaCuota, Moneda, TipoDeuda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { aNumero, convertir, redondear } from "@/lib/moneda";

export type EstadoCapacidad = "disponible" | "en_limite" | "excedido" | "sin_datos";

export interface CapacidadEndeudamientoResult {
  ingresoFijoMensual: number;
  compromisosDeudaActuales: number;
  ratioEndeudamientoActual: number;
  umbralMaximoRecomendado: number;
  capacidadDisponible: number;
  estado: EstadoCapacidad;
  monedaReferencia: Moneda;
  /** Desglose por deuda, para poder explicarle al usuario de dónde sale el número. */
  detalle: { nombre: string; costoMensual: number }[];
}

/**
 * Una cuota quincenal no son exactamente 2 al mes: 365/14/12 ≈ 2.17.
 * La spec (sección 4.2) fija 2.15, así que ese es el valor.
 */
export const FACTOR_QUINCENAL = 2.15;

export interface DeudaParaCapacidad {
  nombre: string;
  tipo: TipoDeuda;
  /** Ya convertido a la moneda de referencia. */
  saldoRestante: number;
  montoOriginal: number;
  pagoMinimoMensual: number | null;
  numeroCuotas: number | null;
  frecuenciaCuota: FrecuenciaCuota;
}

/** Normaliza una deuda a lo que cuesta sostenerla cada mes. */
export function costoMensualDeuda(d: DeudaParaCapacidad, pctPagoMinimoTarjeta: number): number {
  if (d.pagoMinimoMensual !== null) return d.pagoMinimoMensual;

  switch (d.tipo) {
    case "TARJETA":
      return redondear(d.saldoRestante * pctPagoMinimoTarjeta);
    case "PRESTAMO_CUOTAS":
    case "BNPL": {
      if (!d.numeroCuotas || d.numeroCuotas <= 0) return 0;
      const cuota = d.montoOriginal / d.numeroCuotas;
      return redondear(d.frecuenciaCuota === "QUINCENAL" ? cuota * FACTOR_QUINCENAL : cuota);
    }
    case "PRESTAMO_INFORMAL":
      // Sin fecha fija ni cuota pactada no hay compromiso mensual que contar.
      return 0;
  }
}

export interface EntradaCapacidad {
  /** Ingresos fijos de los últimos 3 meses, convertidos a moneda de referencia. */
  ingresosFijos3Meses: number[];
  deudas: DeudaParaCapacidad[];
  umbralEndeudamiento: number;
  pctPagoMinimoTarjeta: number;
  monedaReferencia: Moneda;
}

export function computarCapacidadEndeudamiento(e: EntradaCapacidad): CapacidadEndeudamientoResult {
  const ingresoFijoMensual = redondear(e.ingresosFijos3Meses.reduce((a, b) => a + b, 0) / 3);

  const detalle = e.deudas.map((d) => ({
    nombre: d.nombre,
    costoMensual: costoMensualDeuda(d, e.pctPagoMinimoTarjeta),
  }));
  const compromisosDeudaActuales = redondear(
    detalle.reduce((a, d) => a + d.costoMensual, 0),
  );

  const base = {
    ingresoFijoMensual,
    compromisosDeudaActuales,
    umbralMaximoRecomendado: e.umbralEndeudamiento,
    monedaReferencia: e.monedaReferencia,
    detalle,
  };

  // Sin ingreso fijo registrado el ratio no significa nada; no inventamos uno.
  if (ingresoFijoMensual <= 0) {
    return {
      ...base,
      ratioEndeudamientoActual: 0,
      capacidadDisponible: 0,
      estado: "sin_datos",
    };
  }

  const ratio = redondear(compromisosDeudaActuales / ingresoFijoMensual, 4);
  const techo = ingresoFijoMensual * e.umbralEndeudamiento;

  return {
    ...base,
    ratioEndeudamientoActual: ratio,
    // Nunca negativo: en la UI un "-$30 disponible" confunde más de lo que informa.
    capacidadDisponible: redondear(Math.max(0, techo - compromisosDeudaActuales)),
    estado:
      ratio >= e.umbralEndeudamiento
        ? "excedido"
        : ratio >= e.umbralEndeudamiento * 0.8
          ? "en_limite"
          : "disponible",
  };
}

export async function calcularCapacidadEndeudamiento(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<CapacidadEndeudamientoResult> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const monedaReferencia = usuario.monedaReferenciaDefault;
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const conv = (monto: number, moneda: Moneda) => convertir(monto, moneda, monedaReferencia, tasa);

  const [ingresos, deudas] = await Promise.all([
    prisma.movimiento.findMany({
      where: {
        usuarioId,
        tipo: "INGRESO",
        esFijo: true,
        fecha: { gte: subMonths(hoy, 3) },
      },
      select: { monto: true, moneda: true },
    }),
    prisma.deudaPrestamo.findMany({ where: { usuarioId, activa: true } }),
  ]);

  return computarCapacidadEndeudamiento({
    ingresosFijos3Meses: ingresos.map((i) => conv(aNumero(i.monto), i.moneda)),
    deudas: deudas.map((d) => ({
      nombre: d.nombre,
      tipo: d.tipo,
      saldoRestante: conv(aNumero(d.saldoRestante), d.moneda),
      montoOriginal: conv(aNumero(d.montoOriginal), d.moneda),
      pagoMinimoMensual:
        d.pagoMinimoMensual !== null ? conv(aNumero(d.pagoMinimoMensual), d.moneda) : null,
      numeroCuotas: d.numeroCuotas,
      frecuenciaCuota: d.frecuenciaCuota,
    })),
    umbralEndeudamiento: aNumero(usuario.umbralEndeudamiento),
    pctPagoMinimoTarjeta: aNumero(usuario.pctPagoMinimoTarjeta),
    monedaReferencia,
  });
}
