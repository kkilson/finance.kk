import { differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import type { Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { aNumero, convertir, redondear } from "@/lib/moneda";
import { mesPeriodoDe } from "@/lib/periodo";

export type EstadoCobertura = "verde" | "amarillo" | "rojo" | "sin_datos";

export interface DiasCoberturaResult {
  balanceDisponible: number;
  gastoDiarioPromedio: number;
  diasCobertura: number;
  diasHastaProximoIngresoFijo: number | null;
  estado: EstadoCobertura;
  monedaReferencia: Moneda;
  /** Verdadero cuando el promedio se estimó con menos de 30 días de historia. */
  promedioEstimado: boolean;
}

/** Mínimo de movimientos de gasto necesarios para que el promedio signifique algo. */
export const MIN_MOVIMIENTOS_PARA_PROMEDIO = 5;

export interface GastoEntrada {
  monto: number;
  fecha: Date;
}

export interface EntradaDiasCobertura {
  /** Saldos de cuentas activas, ya convertidos a moneda de referencia. */
  saldosConvertidos: number[];
  /** Compromisos PAGO pendientes del mes en curso, convertidos. */
  pagosPendientesConvertidos: number[];
  /** Gastos de los últimos 30 días (o los últimos disponibles), convertidos. */
  gastos: GastoEntrada[];
  /** Fecha esperada del próximo ingreso fijo, si existe. */
  fechaProximoIngresoFijo: Date | null;
  saldoMinimoSeguridad: number;
  monedaReferencia: Moneda;
  hoy: Date;
}

/**
 * Núcleo puro del cálculo — sin base de datos, para poder testearlo directo.
 * Ver sección 4.1 de la spec.
 */
export function computarDiasCobertura(e: EntradaDiasCobertura): DiasCoberturaResult {
  const hoy = startOfDay(e.hoy);
  const saldos = e.saldosConvertidos.reduce((a, b) => a + b, 0);
  const pagos = e.pagosPendientesConvertidos.reduce((a, b) => a + b, 0);
  const balanceDisponible = redondear(saldos - pagos - e.saldoMinimoSeguridad);

  const diasHastaProximoIngresoFijo = e.fechaProximoIngresoFijo
    ? Math.max(0, differenceInCalendarDays(startOfDay(e.fechaProximoIngresoFijo), hoy))
    : null;

  const inicioVentana = subDays(hoy, 30);
  const enVentana = e.gastos.filter((g) => startOfDay(g.fecha) >= inicioVentana);

  // Sin historia suficiente en 30 días, caemos a los últimos movimientos disponibles.
  let muestra = enVentana;
  let divisor = 30;
  let promedioEstimado = false;

  if (enVentana.length === 0) {
    const ordenados = [...e.gastos].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    if (ordenados.length < MIN_MOVIMIENTOS_PARA_PROMEDIO) {
      return {
        balanceDisponible,
        gastoDiarioPromedio: 0,
        diasCobertura: 0,
        diasHastaProximoIngresoFijo,
        estado: "sin_datos",
        monedaReferencia: e.monedaReferencia,
        promedioEstimado: true,
      };
    }
    muestra = ordenados;
    promedioEstimado = true;
    // Repartimos el gasto sobre el rango real que cubren esos movimientos.
    const masViejo = startOfDay(muestra[muestra.length - 1].fecha);
    divisor = Math.max(1, differenceInCalendarDays(hoy, masViejo));
  }

  const total = muestra.reduce((a, g) => a + g.monto, 0);
  const gastoDiarioPromedio = redondear(total / divisor);

  if (gastoDiarioPromedio <= 0) {
    return {
      balanceDisponible,
      gastoDiarioPromedio: 0,
      diasCobertura: 0,
      diasHastaProximoIngresoFijo,
      estado: "sin_datos",
      monedaReferencia: e.monedaReferencia,
      promedioEstimado,
    };
  }

  const diasCobertura = redondear(balanceDisponible / gastoDiarioPromedio, 1);

  let estado: EstadoCobertura;
  if (diasHastaProximoIngresoFijo === null) {
    // Sin ingreso fijo a la vista, lo único que podemos decir es si alcanza o no.
    estado = diasCobertura > 0 ? "verde" : "rojo";
  } else {
    const holgura = diasCobertura - diasHastaProximoIngresoFijo;
    if (holgura < 0) estado = "rojo";
    else if (holgura <= 3) estado = "amarillo";
    else estado = "verde";
  }

  return {
    balanceDisponible,
    gastoDiarioPromedio,
    diasCobertura,
    diasHastaProximoIngresoFijo,
    estado,
    monedaReferencia: e.monedaReferencia,
    promedioEstimado,
  };
}

/** Carga los datos del usuario y aplica el cálculo. */
export async function calcularDiasCobertura(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<DiasCoberturaResult> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const monedaReferencia = usuario.monedaReferenciaDefault;
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const conv = (monto: number, moneda: Moneda) => convertir(monto, moneda, monedaReferencia, tasa);

  const [cuentas, pagosPendientes, gastos, proximoIngreso] = await Promise.all([
    prisma.cuenta.findMany({ where: { usuarioId, activa: true } }),
    prisma.compromisoPresupuesto.findMany({
      where: {
        usuarioId,
        tipo: "PAGO",
        estado: { in: ["PENDIENTE", "ATRASADO"] },
        mesPeriodo: mesPeriodoDe(hoy),
      },
    }),
    prisma.movimiento.findMany({
      where: { usuarioId, tipo: "GASTO", esExtraordinario: false },
      orderBy: { fecha: "desc" },
      take: 400,
      select: { monto: true, moneda: true, fecha: true },
    }),
    prisma.compromisoPresupuesto.findFirst({
      where: {
        usuarioId,
        tipo: "INGRESO_ESPERADO",
        estado: { in: ["PENDIENTE", "ATRASADO"] },
        fechaEsperada: { gte: startOfDay(hoy) },
      },
      orderBy: { fechaEsperada: "asc" },
    }),
  ]);

  return computarDiasCobertura({
    saldosConvertidos: cuentas.map((c) => conv(aNumero(c.saldoActual), c.moneda)),
    pagosPendientesConvertidos: pagosPendientes.map((c) => conv(aNumero(c.monto), c.moneda)),
    gastos: gastos.map((g) => ({ monto: conv(aNumero(g.monto), g.moneda), fecha: g.fecha })),
    fechaProximoIngresoFijo: proximoIngreso?.fechaEsperada ?? null,
    saldoMinimoSeguridad: aNumero(usuario.saldoMinimoSeguridad),
    monedaReferencia,
    hoy,
  });
}
