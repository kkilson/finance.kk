import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { aNumero, convertir, redondear } from "@/lib/moneda";

export interface ResumenDashboard {
  monedaReferencia: Moneda;
  tasaBsPorUsd: number | null;
  balanceTotal: number;
  balancePorMoneda: { moneda: Moneda; total: number }[];
  gastoDelMes: number;
  ingresoDelMes: number;
  ingresoFijoDelMes: number;
  gastoPorCategoria: { nombre: string; color: string | null; icono: string | null; total: number }[];
  tendencia: { mes: string; etiqueta: string; ingresos: number; gastos: number }[];
}

export async function obtenerResumenDashboard(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<ResumenDashboard> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const monedaReferencia = usuario.monedaReferenciaDefault;
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;

  const conv = (monto: number, moneda: Moneda) => {
    try {
      return convertir(monto, moneda, monedaReferencia, tasa);
    } catch {
      // Sin tasa registrada no podemos mezclar monedas; contamos solo lo que ya está
      // en la moneda de referencia en vez de romper el dashboard entero.
      return 0;
    }
  };

  const inicioTendencia = startOfMonth(subMonths(hoy, 5));

  const [cuentas, movimientosMes, movimientosTendencia] = await Promise.all([
    prisma.cuenta.findMany({ where: { usuarioId, activa: true } }),
    prisma.movimiento.findMany({
      where: {
        usuarioId,
        fecha: { gte: startOfMonth(hoy), lte: endOfMonth(hoy) },
        tipo: { in: ["GASTO", "INGRESO"] },
      },
      include: { categoria: true },
    }),
    prisma.movimiento.findMany({
      where: {
        usuarioId,
        fecha: { gte: inicioTendencia, lte: endOfMonth(hoy) },
        tipo: { in: ["GASTO", "INGRESO"] },
      },
      select: { monto: true, moneda: true, fecha: true, tipo: true },
    }),
  ]);

  const porMoneda = new Map<Moneda, number>();
  for (const c of cuentas) {
    porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? 0) + aNumero(c.saldoActual));
  }

  const balanceTotal = redondear(
    cuentas.reduce((acc, c) => acc + conv(aNumero(c.saldoActual), c.moneda), 0),
  );

  let gastoDelMes = 0;
  let ingresoDelMes = 0;
  let ingresoFijoDelMes = 0;
  const porCategoria = new Map<
    string,
    { color: string | null; icono: string | null; total: number }
  >();

  for (const m of movimientosMes) {
    const monto = conv(aNumero(m.monto), m.moneda);
    if (m.tipo === "GASTO") {
      gastoDelMes += monto;
      const nombre = m.categoria?.nombre ?? "Sin categoría";
      const actual = porCategoria.get(nombre);
      porCategoria.set(nombre, {
        color: m.categoria?.color ?? null,
        icono: m.categoria?.icono ?? null,
        total: (actual?.total ?? 0) + monto,
      });
    } else {
      ingresoDelMes += monto;
      if (m.esFijo) ingresoFijoDelMes += monto;
    }
  }

  // Seis meses en orden, incluyendo los vacíos, para que el gráfico no salte.
  const tendencia = Array.from({ length: 6 }, (_, i) => {
    const fecha = startOfMonth(subMonths(hoy, 5 - i));
    return {
      mes: format(fecha, "yyyy-MM"),
      etiqueta: format(fecha, "MMM"),
      ingresos: 0,
      gastos: 0,
    };
  });
  const indice = new Map(tendencia.map((t, i) => [t.mes, i]));
  for (const m of movimientosTendencia) {
    const i = indice.get(format(m.fecha, "yyyy-MM"));
    if (i === undefined) continue;
    const monto = conv(aNumero(m.monto), m.moneda);
    if (m.tipo === "GASTO") tendencia[i].gastos += monto;
    else tendencia[i].ingresos += monto;
  }
  for (const t of tendencia) {
    t.ingresos = redondear(t.ingresos);
    t.gastos = redondear(t.gastos);
  }

  return {
    monedaReferencia,
    tasaBsPorUsd: tasa,
    balanceTotal,
    balancePorMoneda: [...porMoneda.entries()].map(([moneda, total]) => ({
      moneda,
      total: redondear(total),
    })),
    gastoDelMes: redondear(gastoDelMes),
    ingresoDelMes: redondear(ingresoDelMes),
    ingresoFijoDelMes: redondear(ingresoFijoDelMes),
    gastoPorCategoria: [...porCategoria.entries()]
      .map(([nombre, v]) => ({
        nombre,
        color: v.color,
        icono: v.icono,
        total: redondear(v.total),
      }))
      .sort((a, b) => b.total - a.total),
    tendencia,
  };
}
