import { addDays, addMonths } from "date-fns";
import type { FrecuenciaCuota, Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { aNumero, convertir, redondear } from "@/lib/moneda";
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

export interface PlanCuotas {
  /** Lo que se pagó al comprar (0% es un caso normal en Cashea). */
  inicial: number;
  /** Monto que queda repartido en cuotas. */
  financiado: number;
  cuotas: Cuota[];
  /** Las que el usuario declara ya pagadas al registrar la deuda. */
  pagadas: Cuota[];
  /** Las que faltan: son las que entran al presupuesto. */
  pendientes: Cuota[];
  /** Lo que realmente se debe hoy. */
  saldoRestante: number;
}

/**
 * Plan de cuotas de una compra a cuotas. La inicial se paga en el momento, así
 * que lo financiado es el monto menos esa inicial. El sobrante del redondeo se
 * ajusta en la última cuota para que la suma cuadre exactamente.
 *
 * `cuotasPagadas` existe porque casi nunca registras la deuda el día que
 * compras: lo normal es cargarla cuando ya llevas una o dos cuotas encima, y
 * entonces ni el saldo es el total ni esas cuotas deben aparecer por pagar.
 */
export function generarCuotasBnpl(params: {
  montoOriginal: number;
  pctInicial: number | null;
  numeroCuotas: number;
  frecuenciaCuota: FrecuenciaCuota;
  fechaCompra: Date;
  cuotasPagadas?: number;
}): PlanCuotas {
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

  const yaPagadas = Math.min(Math.max(params.cuotasPagadas ?? 0, 0), params.numeroCuotas);
  const pagadas = cuotas.slice(0, yaPagadas);
  const pendientes = cuotas.slice(yaPagadas);

  return {
    inicial,
    financiado,
    cuotas,
    pagadas,
    pendientes,
    saldoRestante: redondear(pendientes.reduce((a, c) => a + c.monto, 0)),
  };
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
  | {
      tipo: "PRESTAMO_CUOTAS";
      numeroCuotas: number;
      frecuenciaCuota: FrecuenciaCuota;
      fechaCompra?: Date;
      cuotasPagadas?: number;
    }
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
      cuotasPagadas?: number;
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
      cuotasPagadas: input.cuotasPagadas,
    });

    return prisma.$transaction(async (tx) => {
      const deuda = await tx.deudaPrestamo.create({
        data: {
          ...comun,
          tipo: "BNPL",
          // Lo que se debe hoy: lo financiado menos las cuotas ya pagadas.
          saldoRestante: input.saldoRestante ?? plan.saldoRestante,
          plataformaBnpl: input.plataformaBnpl,
          numeroCuotas: input.numeroCuotas,
          frecuenciaCuota: input.frecuenciaCuota,
          nivelUsuario: input.nivelUsuario ?? null,
          pctInicial: input.pctInicial ?? null,
          penalidadPorAtraso: input.penalidadPorAtraso ?? null,
          comercioAfiliado: input.comercioAfiliado ?? null,
          producto: input.producto ?? null,
          fechaProximoPago: input.fechaProximoPago ?? plan.pendientes[0]?.fecha ?? null,
        },
      });

      if (input.generarCuotas) {
        // Solo las que faltan: las ya pagadas no deben aparecer por pagar.
        await tx.compromisoPresupuesto.createMany({
          data: plan.pendientes.map((c) => ({
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
    const plan = generarCuotasBnpl({
      montoOriginal: input.montoOriginal,
      pctInicial: null,
      numeroCuotas: input.numeroCuotas,
      frecuenciaCuota: input.frecuenciaCuota,
      fechaCompra: input.fechaCompra ?? new Date(),
      cuotasPagadas: input.cuotasPagadas,
    });
    return prisma.deudaPrestamo.create({
      data: {
        ...comun,
        tipo: "PRESTAMO_CUOTAS",
        numeroCuotas: input.numeroCuotas,
        frecuenciaCuota: input.frecuenciaCuota,
        saldoRestante: input.saldoRestante ?? plan.saldoRestante,
        fechaProximoPago: input.fechaProximoPago ?? plan.pendientes[0]?.fecha ?? null,
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

/**
 * Deshace un pago de deuda. Toca cuatro cosas a la vez, y por eso no se puede
 * borrar el movimiento suelto desde Movimientos: hay que devolver el saldo a la
 * cuenta, subir de nuevo el saldo de la deuda, reabrirla si se había cerrado
 * con ese pago, y devolver el compromiso a pendiente si venía del presupuesto.
 */
export async function eliminarPagoDeuda(usuarioId: string, deudaId: string, pagoId: string) {
  const pago = await prisma.pagoDeuda.findFirst({
    where: { id: pagoId, deudaId, deuda: { usuarioId } },
    include: {
      deuda: true,
      movimiento: { include: { cuenta: true } },
    },
  });
  if (!pago) throw new NoEncontradoError("Pago");

  const mov = pago.movimiento;
  const tasa = mov.tasaCambioAplicada ? aNumero(mov.tasaCambioAplicada) : null;
  // Se devuelve a la cuenta lo mismo que se le restó, en la moneda de la cuenta.
  const enMonedaCuenta = redondear(
    convertir(aNumero(mov.monto), mov.moneda, mov.cuenta.moneda, tasa),
  );

  // Intereses y penalidad no habían bajado capital, así que tampoco vuelven.
  const aCapital = redondear(
    aNumero(pago.monto) - aNumero(pago.interesIncluido) - aNumero(pago.penalidadIncluida),
  );
  const saldoRestaurado = redondear(aNumero(pago.deuda.saldoRestante) + aCapital);

  await prisma.$transaction(async (tx) => {
    await tx.pagoDeuda.delete({ where: { id: pago.id } });

    if (mov.compromisoId) {
      await tx.compromisoPresupuesto.update({
        where: { id: mov.compromisoId },
        data: { estado: "PENDIENTE" },
      });
    }

    await tx.movimiento.delete({ where: { id: mov.id } });
    await tx.cuenta.update({
      where: { id: mov.cuentaId },
      data: { saldoActual: { increment: enMonedaCuenta } },
    });
    await tx.deudaPrestamo.update({
      where: { id: pago.deudaId },
      data: { saldoRestante: saldoRestaurado, activa: true },
    });
  });

  return { eliminado: true, saldoRestante: saldoRestaurado };
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
