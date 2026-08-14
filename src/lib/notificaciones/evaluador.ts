import { endOfMonth, startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calcularCapacidadEndeudamiento } from "@/lib/calculos/capacidad-endeudamiento";
import { calcularDiasCobertura } from "@/lib/calculos/dias-cobertura";
import { aNumero, convertir, formatearMonto, redondear } from "@/lib/moneda";
import { mesPeriodoDe } from "@/lib/periodo";
import type { Moneda } from "@/generated/prisma/enums";
import {
  evaluarReglas,
  type ConfigRegla,
  type HechoNotificable,
  type SnapshotUsuario,
} from "./reglas";

/** Reúne el estado actual del usuario en la forma que consumen las reglas. */
export async function construirSnapshot(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<SnapshotUsuario> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const ref = usuario.monedaReferenciaDefault;
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const conv = (monto: number, moneda: Moneda) => {
    try {
      return convertir(monto, moneda, ref, tasa);
    } catch {
      return 0;
    }
  };

  const periodo = mesPeriodoDe(hoy);
  const [compromisos, deudas, movimientosMes] = await Promise.all([
    prisma.compromisoPresupuesto.findMany({
      where: { usuarioId, mesPeriodo: periodo },
      include: { deuda: true },
      orderBy: { fechaEsperada: "asc" },
    }),
    prisma.deudaPrestamo.findMany({ where: { usuarioId, activa: true } }),
    prisma.movimiento.findMany({
      where: {
        usuarioId,
        tipo: { in: ["GASTO", "INGRESO"] },
        fecha: { gte: startOfMonth(hoy), lte: endOfMonth(hoy) },
      },
      select: { monto: true, moneda: true, tipo: true, esFijo: true },
    }),
  ]);

  let cobertura = null;
  try {
    const c = await calcularDiasCobertura(usuarioId, hoy);
    cobertura = {
      estado: c.estado,
      diasCobertura: c.diasCobertura,
      diasHastaProximoIngresoFijo: c.diasHastaProximoIngresoFijo,
    };
  } catch {
    // Sin tasa de cambio no hay cobertura que evaluar; el resto de reglas sigue.
  }

  const cap = await calcularCapacidadEndeudamiento(usuarioId, hoy);

  const gastoDelMes = redondear(
    movimientosMes
      .filter((m) => m.tipo === "GASTO")
      .reduce((a, m) => a + conv(aNumero(m.monto), m.moneda), 0),
  );
  const ingresoDelMes = redondear(
    movimientosMes
      .filter((m) => m.tipo === "INGRESO")
      .reduce((a, m) => a + conv(aNumero(m.monto), m.moneda), 0),
  );
  const presupuestado = redondear(
    compromisos
      .filter((c) => c.tipo === "PAGO")
      .reduce((a, c) => a + conv(aNumero(c.monto), c.moneda), 0),
  );

  return {
    hoy,
    monedaReferencia: ref,
    compromisos: compromisos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      concepto: c.concepto,
      montoFormateado: formatearMonto(aNumero(c.monto), c.moneda),
      fechaEsperada: c.fechaEsperada,
      estado: c.estado,
      esCuotaBnpl: c.deuda?.tipo === "BNPL",
    })),
    tarjetas: deudas
      .filter((d) => d.tipo === "TARJETA" && aNumero(d.limite) > 0)
      .map((d) => ({
        nombre: d.nombre,
        pctUso: (aNumero(d.saldoRestante) / aNumero(d.limite)) * 100,
        saldoFormateado: formatearMonto(aNumero(d.saldoRestante), d.moneda),
        limiteFormateado: formatearMonto(aNumero(d.limite), d.moneda),
      })),
    cobertura,
    capacidad: {
      estado: cap.estado,
      compromisosFormateado: formatearMonto(cap.compromisosDeudaActuales, ref),
      ingresoFormateado: formatearMonto(cap.ingresoFijoMensual, ref),
    },
    gastoDelMes,
    // Preferimos medir contra el presupuesto del mes; si no hay, contra ingresos.
    referenciaMensual: presupuestado > 0 ? presupuestado : ingresoDelMes,
    gastoFormateado: formatearMonto(gastoDelMes, ref),
  };
}

export async function hechosPendientes(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<HechoNotificable[]> {
  const [snapshot, configsDb] = await Promise.all([
    construirSnapshot(usuarioId, hoy),
    prisma.notificacionConfig.findMany({ where: { usuarioId } }),
  ]);

  const configs: ConfigRegla[] = configsDb.map((c) => ({
    regla: c.regla,
    activa: c.activa,
    parametro: c.parametro !== null ? aNumero(c.parametro) : null,
    horaDesde: c.horaDesde,
    horaHasta: c.horaHasta,
  }));

  const hechos = evaluarReglas(snapshot, configs);
  if (hechos.length === 0) return [];

  // Descartamos lo que ya se envió: la clave de dedup es única por usuario.
  const yaEnviadas = await prisma.notificacionEnviada.findMany({
    where: { usuarioId, claveDedup: { in: hechos.map((h) => h.claveDedup) } },
    select: { claveDedup: true },
  });
  const vistas = new Set(yaEnviadas.map((n) => n.claveDedup));
  return hechos.filter((h) => !vistas.has(h.claveDedup));
}
