import { addDays, addMonths } from "date-fns";
import type { FrecuenciaCuota, Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { aNumero, redondear } from "@/lib/moneda";
import { mesPeriodoDe } from "@/lib/periodo";
import { crearMovimiento } from "@/lib/servicios/movimientos";

export interface Cuota {
  numero: number;
  fecha: Date;
  monto: number;
}

/** Cada 14 días para quincenal (spec sección 5), cada mes para mensual. */
export function fechaDeCuota(inicio: Date, numero: number, frecuencia: FrecuenciaCuota): Date {
  return frecuencia === "QUINCENAL" ? addDays(inicio, 14 * numero) : addMonths(inicio, numero);
}

/**
 * Plan de cuotas de una compra BNPL. La inicial se paga en el momento, así que
 * lo que queda financiado es el monto menos esa inicial.
 * El redondeo sobrante se ajusta en la última cuota para que la suma cuadre.
 */
export function generarCuotasBnpl(params: {
  montoOriginal: number;
  pctInicial: number | null;
  numeroCuotas: number;
  frecuenciaCuota: FrecuenciaCuota;
  fechaCompra: Date;
}): { inicial: number; financiado: number; cuotas: Cuota[] } {
  const inicial = redondear((params.montoOriginal * (params.pctInicial ?? 0)) / 100);
  const financiado = redondear(params.montoOriginal - inicial);
  const base = redondear(financiado / params.numeroCuotas);

  const cuotas: Cuota[] = [];
  for (let i = 1; i <= params.numeroCuotas; i++) {
    const esUltima = i === params.numeroCuotas;
    cuotas.push({
      numero: i,
      fecha: fechaDeCuota(params.fechaCompra, i, params.frecuenciaCuota),
      monto: esUltima ? redondear(financiado - base * (params.numeroCuotas - 1)) : base,
    });
  }
  return { inicial, financiado, cuotas };
}

type DeudaInput = {
  nombre: string;
  entidad: string;
  montoOriginal: number;
  moneda: Moneda;
  saldoRestante?: number;
  tasaInteresMensual?: number | null;
  pagoMinimoMensual?: number | null;
  fechaProximoPago?: Date | null;
  diaCierre?: number | null;
} & (
  | { tipo: "TARJETA"; limite: number }
  | { tipo: "PRESTAMO_CUOTAS"; numeroCuotas: number; frecuenciaCuota: FrecuenciaCuota }
  | { tipo: "PRESTAMO_INFORMAL" }
  | {
      tipo: "BNPL";
      plataformaBnpl: string;
      numeroCuotas: number;
      frecuenciaCuota: FrecuenciaCuota;
      nivelUsuario?: string | null;
      pctInicial?: number | null;
      penalidadPorAtraso?: number | null;
      comercioAfiliado?: string | null;
      producto?: string | null;
      fechaCompra?: Date;
      generarCuotas: boolean;
    }
);

export async function crearDeuda(usuarioId: string, input: DeudaInput) {
  const comun = {
    usuarioId,
    nombre: input.nombre,
    entidad: input.entidad,
    montoOriginal: input.montoOriginal,
    moneda: input.moneda,
    tasaInteresMensual: input.tasaInteresMensual ?? null,
    pagoMinimoMensual: input.pagoMinimoMensual ?? null,
    fechaProximoPago: input.fechaProximoPago ?? null,
    diaCierre: input.diaCierre ?? null,
  };

  if (input.tipo === "BNPL") {
    const fechaCompra = input.fechaCompra ?? new Date();
    const plan = generarCuotasBnpl({
      montoOriginal: input.montoOriginal,
      pctInicial: input.pctInicial ?? null,
      numeroCuotas: input.numeroCuotas,
      frecuenciaCuota: input.frecuenciaCuota,
      fechaCompra,
    });

    return prisma.$transaction(async (tx) => {
      const deuda = await tx.deudaPrestamo.create({
        data: {
          ...comun,
          tipo: "BNPL",
          // Lo que realmente se debe es lo financiado; la inicial ya se pagó.
          saldoRestante: input.saldoRestante ?? plan.financiado,
          plataformaBnpl: input.plataformaBnpl,
          numeroCuotas: input.numeroCuotas,
          frecuenciaCuota: input.frecuenciaCuota,
          nivelUsuario: input.nivelUsuario ?? null,
          pctInicial: input.pctInicial ?? null,
          penalidadPorAtraso: input.penalidadPorAtraso ?? null,
          comercioAfiliado: input.comercioAfiliado ?? null,
          producto: input.producto ?? null,
          fechaProximoPago: input.fechaProximoPago ?? plan.cuotas[0]?.fecha ?? null,
        },
      });

      if (input.generarCuotas) {
        // Cada cuota futura entra al presupuesto sola, sin que el usuario
        // tenga que crear 6 compromisos a mano (sección 5).
        await tx.compromisoPresupuesto.createMany({
          data: plan.cuotas.map((c) => ({
            usuarioId,
            tipo: "PAGO" as const,
            concepto: `${input.plataformaBnpl} — ${input.nombre} (cuota ${c.numero}/${input.numeroCuotas})`,
            deudaId: deuda.id,
            monto: c.monto,
            moneda: input.moneda,
            fechaEsperada: c.fecha,
            mesPeriodo: mesPeriodoDe(c.fecha),
            esRecurrente: false,
          })),
        });
      }

      return deuda;
    });
  }

  if (input.tipo === "TARJETA") {
    return prisma.deudaPrestamo.create({
      data: {
        ...comun,
        tipo: "TARJETA",
        limite: input.limite,
        saldoRestante: input.saldoRestante ?? input.montoOriginal,
      },
    });
  }

  if (input.tipo === "PRESTAMO_CUOTAS") {
    return prisma.deudaPrestamo.create({
      data: {
        ...comun,
        tipo: "PRESTAMO_CUOTAS",
        numeroCuotas: input.numeroCuotas,
        frecuenciaCuota: input.frecuenciaCuota,
        saldoRestante: input.saldoRestante ?? input.montoOriginal,
      },
    });
  }

  return prisma.deudaPrestamo.create({
    data: {
      ...comun,
      tipo: "PRESTAMO_INFORMAL",
      saldoRestante: input.saldoRestante ?? input.montoOriginal,
    },
  });
}

/** Pago suelto de una deuda (fuera del presupuesto): movimiento + PagoDeuda + saldo. */
export async function registrarPagoDeuda(
  usuarioId: string,
  deudaId: string,
  datos: {
    cuentaId: string;
    monto: number;
    fecha?: Date;
    interesIncluido?: number | null;
    penalidadIncluida?: number | null;
    categoriaId?: string | null;
  },
) {
  const deuda = await prisma.deudaPrestamo.findFirst({ where: { id: deudaId, usuarioId } });
  if (!deuda) throw new NoEncontradoError("Deuda");
  if (!deuda.activa) throw new ReglaNegocioError("Esa deuda ya está cerrada");

  const fecha = datos.fecha ?? new Date();
  const movimiento = await crearMovimiento(usuarioId, {
    cuentaId: datos.cuentaId,
    categoriaId: datos.categoriaId ?? null,
    tipo: "GASTO",
    monto: datos.monto,
    moneda: deuda.moneda,
    fecha,
    nota: `Pago ${deuda.nombre}`,
  });

  // Intereses y penalidad no amortizan capital.
  const aCapital =
    datos.monto - (datos.interesIncluido ?? 0) - (datos.penalidadIncluida ?? 0);
  const nuevoSaldo = Math.max(0, redondear(aNumero(deuda.saldoRestante) - aCapital));

  await prisma.$transaction([
    prisma.pagoDeuda.create({
      data: {
        deudaId: deuda.id,
        movimientoId: movimiento.id,
        monto: datos.monto,
        fecha,
        interesIncluido: datos.interesIncluido ?? null,
        penalidadIncluida: datos.penalidadIncluida ?? null,
      },
    }),
    prisma.deudaPrestamo.update({
      where: { id: deuda.id },
      data: { saldoRestante: nuevoSaldo, activa: nuevoSaldo > 0 },
    }),
  ]);

  return { movimiento, saldoRestante: nuevoSaldo };
}
