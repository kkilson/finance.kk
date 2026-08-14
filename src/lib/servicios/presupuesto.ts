import { getDate, getDaysInMonth, setDate, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { aNumero, convertir, redondear } from "@/lib/moneda";
import { inicioDePeriodo, mesPeriodoDe } from "@/lib/periodo";
import { crearMovimiento } from "@/lib/servicios/movimientos";
import type { Moneda } from "@/generated/prisma/enums";

export async function resumenPresupuesto(usuarioId: string, mesPeriodo: string) {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const conv = (monto: number, moneda: Moneda) => {
    try {
      return convertir(monto, moneda, usuario.monedaReferenciaDefault, tasa);
    } catch {
      return 0;
    }
  };

  const compromisos = await prisma.compromisoPresupuesto.findMany({
    where: { usuarioId, mesPeriodo },
    include: { categoria: true, deuda: true },
    orderBy: { fechaEsperada: "asc" },
  });

  const pagos = compromisos.filter((c) => c.tipo === "PAGO");
  const saldado = (estado: string) => estado === "PAGADO" || estado === "COBRADO";

  return {
    mesPeriodo,
    monedaReferencia: usuario.monedaReferenciaDefault,
    compromisos,
    totales: {
      presupuestado: redondear(pagos.reduce((a, c) => a + conv(aNumero(c.monto), c.moneda), 0)),
      pagado: redondear(
        pagos
          .filter((c) => saldado(c.estado))
          .reduce((a, c) => a + conv(aNumero(c.monto), c.moneda), 0),
      ),
      pendiente: redondear(
        pagos
          .filter((c) => !saldado(c.estado))
          .reduce((a, c) => a + conv(aNumero(c.monto), c.moneda), 0),
      ),
      totalCompromisos: pagos.length,
      compromisosSaldados: pagos.filter((c) => saldado(c.estado)).length,
    },
  };
}

export async function crearCompromiso(
  usuarioId: string,
  datos: {
    tipo: "PAGO" | "INGRESO_ESPERADO";
    concepto: string;
    categoriaId?: string | null;
    deudaId?: string | null;
    monto: number;
    moneda: Moneda;
    fechaEsperada: Date;
    esRecurrente?: boolean;
  },
) {
  if (datos.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: datos.categoriaId, usuarioId },
    });
    if (!cat) throw new NoEncontradoError("Categoría");
  }
  if (datos.deudaId) {
    const deuda = await prisma.deudaPrestamo.findFirst({
      where: { id: datos.deudaId, usuarioId },
    });
    if (!deuda) throw new NoEncontradoError("Deuda");
  }

  return prisma.compromisoPresupuesto.create({
    data: {
      usuarioId,
      tipo: datos.tipo,
      concepto: datos.concepto,
      categoriaId: datos.categoriaId ?? null,
      deudaId: datos.deudaId ?? null,
      monto: datos.monto,
      moneda: datos.moneda,
      fechaEsperada: datos.fechaEsperada,
      mesPeriodo: mesPeriodoDe(datos.fechaEsperada),
      esRecurrente: datos.esRecurrente ?? false,
    },
    include: { categoria: true, deuda: true },
  });
}

/**
 * Crea el movimiento correspondiente, marca el compromiso como saldado y —si
 * está atado a una deuda— registra el PagoDeuda y baja el saldo restante.
 */
export async function marcarCompromisoPagado(
  usuarioId: string,
  compromisoId: string,
  datos: { cuentaId: string; fecha?: Date },
) {
  const compromiso = await prisma.compromisoPresupuesto.findFirst({
    where: { id: compromisoId, usuarioId },
    include: { deuda: true },
  });
  if (!compromiso) throw new NoEncontradoError("Compromiso");
  if (compromiso.estado === "PAGADO" || compromiso.estado === "COBRADO") {
    throw new ReglaNegocioError("Ese compromiso ya está saldado");
  }

  const fecha = datos.fecha ?? new Date();
  const monto = aNumero(compromiso.monto);

  // crearMovimiento ya ajusta saldos y marca el compromiso dentro de su transacción.
  const movimiento = await crearMovimiento(usuarioId, {
    cuentaId: datos.cuentaId,
    categoriaId: compromiso.categoriaId,
    tipo: compromiso.tipo === "PAGO" ? "GASTO" : "INGRESO",
    monto,
    moneda: compromiso.moneda,
    fecha,
    nota: compromiso.concepto,
    compromisoId: compromiso.id,
  });

  if (compromiso.deuda) {
    const saldoActual = aNumero(compromiso.deuda.saldoRestante);
    await prisma.$transaction([
      prisma.pagoDeuda.create({
        data: {
          deudaId: compromiso.deuda.id,
          movimientoId: movimiento.id,
          monto,
          fecha,
        },
      }),
      prisma.deudaPrestamo.update({
        where: { id: compromiso.deuda.id },
        // El saldo no baja de cero aunque el pago incluya intereses o penalidad.
        data: { saldoRestante: Math.max(0, redondear(saldoActual - monto)) },
      }),
    ]);
  }

  return movimiento;
}

/** Mismo día del mes destino; si no existe (31 en un mes de 30), el último día. */
export function trasladarFecha(fecha: Date, mesDestino: string): Date {
  const base = inicioDePeriodo(mesDestino);
  const dia = Math.min(getDate(fecha), getDaysInMonth(base));
  return setDate(base, dia);
}

export async function copiarMesAnterior(
  usuarioId: string,
  mesOrigen: string,
  mesDestino: string,
) {
  if (mesOrigen === mesDestino) {
    throw new ReglaNegocioError("El mes origen y el destino no pueden ser el mismo", "mesDestino");
  }

  const origen = await prisma.compromisoPresupuesto.findMany({
    where: { usuarioId, mesPeriodo: mesOrigen, esRecurrente: true },
  });
  if (origen.length === 0) {
    throw new ReglaNegocioError(
      `No hay compromisos recurrentes en ${mesOrigen} para copiar`,
      "mesOrigen",
    );
  }

  // No duplicar lo que ya exista en el destino con el mismo concepto.
  const yaEnDestino = await prisma.compromisoPresupuesto.findMany({
    where: { usuarioId, mesPeriodo: mesDestino },
    select: { concepto: true },
  });
  const conceptos = new Set(yaEnDestino.map((c) => c.concepto));
  const aCrear = origen.filter((c) => !conceptos.has(c.concepto));

  if (aCrear.length === 0) return { creados: 0, omitidos: origen.length };

  await prisma.compromisoPresupuesto.createMany({
    data: aCrear.map((c) => ({
      usuarioId,
      tipo: c.tipo,
      concepto: c.concepto,
      categoriaId: c.categoriaId,
      deudaId: c.deudaId,
      monto: c.monto,
      moneda: c.moneda,
      fechaEsperada: trasladarFecha(c.fechaEsperada, mesDestino),
      mesPeriodo: mesDestino,
      estado: "PENDIENTE" as const,
      esRecurrente: true,
    })),
  });

  return { creados: aCrear.length, omitidos: origen.length - aCrear.length };
}

/**
 * Marca como ATRASADO lo que venció sin pagarse, y devuelve a PENDIENTE lo que
 * ya no lo está. Idempotente en los dos sentidos.
 *
 * El corte es el inicio del día, no el instante: un pago esperado HOY no está
 * atrasado a media tarde. Comparar contra `now` lo marcaba en rojo apenas
 * pasaba la hora del registro, que además es un mediodía arbitrario que pone
 * el formulario.
 */
export async function marcarAtrasados(usuarioId: string, hoy: Date = new Date()) {
  const corte = startOfDay(hoy);

  const [atrasados, alDia] = await prisma.$transaction([
    prisma.compromisoPresupuesto.updateMany({
      where: { usuarioId, estado: "PENDIENTE", fechaEsperada: { lt: corte } },
      data: { estado: "ATRASADO" },
    }),
    prisma.compromisoPresupuesto.updateMany({
      where: { usuarioId, estado: "ATRASADO", fechaEsperada: { gte: corte } },
      data: { estado: "PENDIENTE" },
    }),
  ]);

  return { marcados: atrasados.count, revertidos: alDia.count };
}
