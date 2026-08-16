import type { Moneda, TipoMovimiento } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { aNumero, convertir, redondear } from "@/lib/moneda";

export interface CrearMovimientoInput {
  cuentaId: string;
  categoriaId?: string | null;
  tipo: TipoMovimiento;
  monto: number;
  moneda: Moneda;
  fecha?: Date;
  nota?: string | null;
  esFijo?: boolean;
  esRecurrente?: boolean;
  esExtraordinario?: boolean;
  cuentaDestinoId?: string | null;
  compromisoId?: string | null;
}

/**
 * Crea un movimiento y ajusta los saldos afectados en una sola transacción.
 * Un bug acá corrompe balances, así que todo pasa por este único camino
 * (lo usan tanto POST /api/movimientos como "marcar compromiso como pagado").
 */
export async function crearMovimiento(usuarioId: string, input: CrearMovimientoInput) {
  const fecha = input.fecha ?? new Date();

  const cuentaOrigen = await prisma.cuenta.findFirst({
    where: { id: input.cuentaId, usuarioId },
  });
  if (!cuentaOrigen) throw new NoEncontradoError("Cuenta");
  if (!cuentaOrigen.activa) throw new ReglaNegocioError("La cuenta está archivada", "cuentaId");

  let cuentaDestino = null;
  if (input.tipo === "TRANSFERENCIA") {
    cuentaDestino = await prisma.cuenta.findFirst({
      where: { id: input.cuentaDestinoId ?? "", usuarioId },
    });
    if (!cuentaDestino) throw new NoEncontradoError("Cuenta destino");
    if (!cuentaDestino.activa) {
      throw new ReglaNegocioError("La cuenta destino está archivada", "cuentaDestinoId");
    }
  }

  if (input.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: input.categoriaId, usuarioId },
    });
    if (!cat) throw new NoEncontradoError("Categoría");
    if (input.tipo !== "TRANSFERENCIA") {
      const esperado = input.tipo === "INGRESO" ? "INGRESO" : "GASTO";
      if (cat.tipo !== esperado) {
        throw new ReglaNegocioError(
          `La categoría "${cat.nombre}" es de tipo ${cat.tipo} y el movimiento es ${input.tipo}`,
          "categoriaId",
        );
      }
    }
  }

  let compromiso = null;
  if (input.compromisoId) {
    compromiso = await prisma.compromisoPresupuesto.findFirst({
      where: { id: input.compromisoId, usuarioId },
    });
    if (!compromiso) throw new NoEncontradoError("Compromiso");
    if (compromiso.estado === "PAGADO" || compromiso.estado === "COBRADO") {
      throw new ReglaNegocioError("Ese compromiso ya está saldado", "compromisoId");
    }
  }

  // Se congela la tasa vigente al momento del registro: así el histórico no se
  // distorsiona si la tasa cambia después (sección 6.4 del PRD).
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;

  // El saldo de cada cuenta vive en la moneda de la cuenta, no en la del movimiento.
  const enMonedaOrigen = redondear(convertir(input.monto, input.moneda, cuentaOrigen.moneda, tasa));
  const enMonedaDestino = cuentaDestino
    ? redondear(convertir(input.monto, input.moneda, cuentaDestino.moneda, tasa))
    : 0;

  const delta = input.tipo === "INGRESO" ? enMonedaOrigen : -enMonedaOrigen;

  return prisma.$transaction(async (tx) => {
    const movimiento = await tx.movimiento.create({
      data: {
        usuarioId,
        cuentaId: cuentaOrigen.id,
        cuentaDestinoId: cuentaDestino?.id ?? null,
        categoriaId: input.categoriaId ?? null,
        tipo: input.tipo,
        monto: input.monto,
        moneda: input.moneda,
        tasaCambioAplicada: tasa,
        fecha,
        nota: input.nota ?? null,
        esFijo: input.esFijo ?? false,
        esRecurrente: input.esRecurrente ?? false,
        esExtraordinario: input.esExtraordinario ?? false,
        compromisoId: compromiso?.id ?? null,
      },
      include: { cuenta: true, categoria: true, cuentaDestino: true },
    });

    await tx.cuenta.update({
      where: { id: cuentaOrigen.id },
      data: { saldoActual: { increment: delta } },
    });

    if (cuentaDestino) {
      await tx.cuenta.update({
        where: { id: cuentaDestino.id },
        data: { saldoActual: { increment: enMonedaDestino } },
      });
    }

    if (compromiso) {
      await tx.compromisoPresupuesto.update({
        where: { id: compromiso.id },
        data: { estado: compromiso.tipo === "PAGO" ? "PAGADO" : "COBRADO" },
      });
    }

    return movimiento;
  });
}

/** Revierte el efecto de un movimiento sobre los saldos y lo borra. */
export async function eliminarMovimiento(usuarioId: string, movimientoId: string) {
  const mov = await prisma.movimiento.findFirst({
    where: { id: movimientoId, usuarioId },
    include: { cuenta: true, cuentaDestino: true, pagosDeuda: true },
  });
  if (!mov) throw new NoEncontradoError("Movimiento");
  if (mov.pagosDeuda.length > 0) {
    throw new ReglaNegocioError(
      "Este movimiento es el pago de una deuda. Deshazlo en Deudas → la deuda → Pagos → " +
        "Deshacer, así también vuelven a su sitio el saldo de la deuda y la cuota del presupuesto",
    );
  }

  const tasa = mov.tasaCambioAplicada ? aNumero(mov.tasaCambioAplicada) : null;
  const monto = aNumero(mov.monto);
  const enMonedaOrigen = redondear(convertir(monto, mov.moneda, mov.cuenta.moneda, tasa));
  const delta = mov.tipo === "INGRESO" ? -enMonedaOrigen : enMonedaOrigen;

  return prisma.$transaction(async (tx) => {
    if (mov.compromisoId) {
      await tx.compromisoPresupuesto.update({
        where: { id: mov.compromisoId },
        data: { estado: "PENDIENTE" },
      });
    }
    await tx.movimiento.delete({ where: { id: mov.id } });
    await tx.cuenta.update({
      where: { id: mov.cuentaId },
      data: { saldoActual: { increment: delta } },
    });
    if (mov.cuentaDestino) {
      const enMonedaDestino = redondear(
        convertir(monto, mov.moneda, mov.cuentaDestino.moneda, tasa),
      );
      await tx.cuenta.update({
        where: { id: mov.cuentaDestino.id },
        data: { saldoActual: { decrement: enMonedaDestino } },
      });
    }
    return { eliminado: true };
  });
}
