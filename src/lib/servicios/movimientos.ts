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

/** Cuánto mueve un movimiento el saldo de su cuenta origen, con signo. */
function deltaEnOrigen(
  tipo: TipoMovimiento,
  monto: number,
  moneda: Moneda,
  monedaCuenta: Moneda,
  tasa: number | null,
): number {
  const enMonedaCuenta = redondear(convertir(monto, moneda, monedaCuenta, tasa));
  return tipo === "INGRESO" ? enMonedaCuenta : -enMonedaCuenta;
}

export interface EditarMovimientoInput extends Partial<CrearMovimientoInput> {
  esExtraordinario?: boolean;
}

/**
 * Edita un movimiento recalculando saldos: revierte el efecto anterior y aplica
 * el nuevo dentro de una misma transacción. Es la única forma segura de dejar
 * cambiar monto, cuenta o tipo sin que los saldos queden a la deriva.
 */
export async function actualizarMovimiento(
  usuarioId: string,
  movimientoId: string,
  cambios: EditarMovimientoInput,
) {
  const previo = await prisma.movimiento.findFirst({
    where: { id: movimientoId, usuarioId },
    include: { cuenta: true, cuentaDestino: true, pagosDeuda: true },
  });
  if (!previo) throw new NoEncontradoError("Movimiento");

  // Un pago de deuda arrastra saldo de la deuda y estado de la cuota; cambiarle
  // el monto por detrás los dejaría mintiendo.
  const tocaElDinero =
    cambios.monto !== undefined ||
    cambios.moneda !== undefined ||
    cambios.tipo !== undefined ||
    cambios.cuentaId !== undefined ||
    cambios.cuentaDestinoId !== undefined;

  if (previo.pagosDeuda.length > 0 && tocaElDinero) {
    throw new ReglaNegocioError(
      "Este movimiento es el pago de una deuda: para cambiar el monto o la cuenta, " +
        "deshazlo en Deudas y regístralo de nuevo",
    );
  }

  const tipo = cambios.tipo ?? previo.tipo;
  const monto = cambios.monto ?? aNumero(previo.monto);
  const moneda = cambios.moneda ?? previo.moneda;

  const cuentaNueva =
    cambios.cuentaId && cambios.cuentaId !== previo.cuentaId
      ? await prisma.cuenta.findFirst({ where: { id: cambios.cuentaId, usuarioId } })
      : previo.cuenta;
  if (!cuentaNueva) throw new NoEncontradoError("Cuenta");

  let destinoNuevo = previo.cuentaDestino;
  if (tipo !== "TRANSFERENCIA") {
    destinoNuevo = null;
  } else if (cambios.cuentaDestinoId !== undefined) {
    destinoNuevo = cambios.cuentaDestinoId
      ? await prisma.cuenta.findFirst({ where: { id: cambios.cuentaDestinoId, usuarioId } })
      : null;
  }
  if (tipo === "TRANSFERENCIA") {
    if (!destinoNuevo) throw new ReglaNegocioError("Falta la cuenta destino", "cuentaDestinoId");
    if (destinoNuevo.id === cuentaNueva.id) {
      throw new ReglaNegocioError("La cuenta destino debe ser distinta", "cuentaDestinoId");
    }
  }

  if (cambios.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: cambios.categoriaId, usuarioId },
    });
    if (!cat) throw new NoEncontradoError("Categoría");
    if (tipo !== "TRANSFERENCIA") {
      const esperado = tipo === "INGRESO" ? "INGRESO" : "GASTO";
      if (cat.tipo !== esperado) {
        throw new ReglaNegocioError(
          `La categoría "${cat.nombre}" es de tipo ${cat.tipo} y el movimiento es ${tipo}`,
          "categoriaId",
        );
      }
    }
  }

  // La tasa original se conserva: es la que estaba vigente cuando ocurrió.
  const tasa = previo.tasaCambioAplicada ? aNumero(previo.tasaCambioAplicada) : null;

  const ajustes = new Map<string, number>();
  const acumular = (cuentaId: string, delta: number) =>
    ajustes.set(cuentaId, redondear((ajustes.get(cuentaId) ?? 0) + delta));

  // Revertir lo viejo…
  acumular(
    previo.cuentaId,
    -deltaEnOrigen(previo.tipo, aNumero(previo.monto), previo.moneda, previo.cuenta.moneda, tasa),
  );
  if (previo.cuentaDestino) {
    acumular(
      previo.cuentaDestino.id,
      -redondear(
        convertir(aNumero(previo.monto), previo.moneda, previo.cuentaDestino.moneda, tasa),
      ),
    );
  }
  // …y aplicar lo nuevo.
  acumular(cuentaNueva.id, deltaEnOrigen(tipo, monto, moneda, cuentaNueva.moneda, tasa));
  if (destinoNuevo) {
    acumular(destinoNuevo.id, redondear(convertir(monto, moneda, destinoNuevo.moneda, tasa)));
  }

  return prisma.$transaction(async (tx) => {
    for (const [cuentaId, delta] of ajustes) {
      if (delta === 0) continue;
      await tx.cuenta.update({
        where: { id: cuentaId },
        data: { saldoActual: { increment: delta } },
      });
    }

    return tx.movimiento.update({
      where: { id: previo.id },
      data: {
        tipo,
        monto,
        moneda,
        cuentaId: cuentaNueva.id,
        cuentaDestinoId: destinoNuevo?.id ?? null,
        categoriaId:
          tipo === "TRANSFERENCIA"
            ? null
            : cambios.categoriaId !== undefined
              ? (cambios.categoriaId ?? null)
              : previo.categoriaId,
        fecha: cambios.fecha ?? previo.fecha,
        nota: cambios.nota !== undefined ? (cambios.nota ?? null) : previo.nota,
        esFijo: tipo === "INGRESO" ? (cambios.esFijo ?? previo.esFijo) : false,
        esRecurrente: cambios.esRecurrente ?? previo.esRecurrente,
        esExtraordinario: cambios.esExtraordinario ?? previo.esExtraordinario,
      },
      include: { cuenta: true, categoria: true, cuentaDestino: true },
    });
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
