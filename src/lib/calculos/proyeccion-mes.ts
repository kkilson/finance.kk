import type { Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { aNumero, convertir, redondear } from "@/lib/moneda";
import { mesPeriodoDe } from "@/lib/periodo";

export interface ProyeccionMesResult {
  mesPeriodo: string;
  balanceActual: number;
  ingresosEsperadosNoCobrados: number;
  pagosPendientesNoPagados: number;
  proyeccionBalanceFinMes: number;
  monedaReferencia: Moneda;
}

export interface EntradaProyeccionMes {
  saldosConvertidos: number[];
  ingresosEsperadosConvertidos: number[];
  pagosPendientesConvertidos: number[];
  mesPeriodo: string;
  monedaReferencia: Moneda;
}

export function computarProyeccionMes(e: EntradaProyeccionMes): ProyeccionMesResult {
  const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const balanceActual = redondear(suma(e.saldosConvertidos));
  const ingresosEsperadosNoCobrados = redondear(suma(e.ingresosEsperadosConvertidos));
  const pagosPendientesNoPagados = redondear(suma(e.pagosPendientesConvertidos));

  return {
    mesPeriodo: e.mesPeriodo,
    balanceActual,
    ingresosEsperadosNoCobrados,
    pagosPendientesNoPagados,
    proyeccionBalanceFinMes: redondear(
      balanceActual + ingresosEsperadosNoCobrados - pagosPendientesNoPagados,
    ),
    monedaReferencia: e.monedaReferencia,
  };
}

export async function calcularProyeccionMes(
  usuarioId: string,
  mesPeriodo?: string,
): Promise<ProyeccionMesResult> {
  const periodo = mesPeriodo ?? mesPeriodoDe(new Date());
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const monedaReferencia = usuario.monedaReferenciaDefault;
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const conv = (monto: number, moneda: Moneda) => convertir(monto, moneda, monedaReferencia, tasa);

  const [cuentas, compromisos] = await Promise.all([
    prisma.cuenta.findMany({ where: { usuarioId, activa: true } }),
    prisma.compromisoPresupuesto.findMany({
      where: { usuarioId, mesPeriodo: periodo, estado: { in: ["PENDIENTE", "ATRASADO"] } },
    }),
  ]);

  return computarProyeccionMes({
    saldosConvertidos: cuentas.map((c) => conv(aNumero(c.saldoActual), c.moneda)),
    ingresosEsperadosConvertidos: compromisos
      .filter((c) => c.tipo === "INGRESO_ESPERADO")
      .map((c) => conv(aNumero(c.monto), c.moneda)),
    pagosPendientesConvertidos: compromisos
      .filter((c) => c.tipo === "PAGO")
      .map((c) => conv(aNumero(c.monto), c.moneda)),
    mesPeriodo: periodo,
    monedaReferencia,
  });
}
