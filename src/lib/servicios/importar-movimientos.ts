import { prisma } from "@/lib/prisma";
import { NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { aNumero, convertir, redondear } from "@/lib/moneda";
import type { Moneda } from "@/generated/prisma/enums";
import {
  mapearFilas,
  type ErrorFila,
  type Fila,
  type Mapeo,
  type OpcionesImportacion,
} from "./importacion";

export interface ResultadoImportacion {
  importados: number;
  omitidosPorDuplicado: number;
  errores: ErrorFila[];
  cuentasAfectadas: { nombre: string; saldoFinal: number }[];
}

function normalizarNombre(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Importa el historial en una sola transacción: crea los movimientos y ajusta
 * cada saldo una vez con el neto, en vez de una escritura por fila.
 */
export async function importarMovimientos(
  usuarioId: string,
  filas: Fila[],
  mapeo: Mapeo,
  opciones: OpcionesImportacion & {
    cuentaPorDefectoId: string;
    omitirDuplicados: boolean;
  },
): Promise<ResultadoImportacion> {
  const { movimientos, errores } = mapearFilas(filas, mapeo, opciones);

  const [cuentas, categorias, tasas] = await Promise.all([
    prisma.cuenta.findMany({ where: { usuarioId } }),
    prisma.categoria.findMany({ where: { usuarioId } }),
    prisma.tasaCambio.findMany({ orderBy: { fecha: "asc" } }),
  ]);

  const cuentaPorDefecto = cuentas.find((c) => c.id === opciones.cuentaPorDefectoId);
  if (!cuentaPorDefecto) throw new NoEncontradoError("Cuenta por defecto");

  const cuentaPorNombre = new Map(cuentas.map((c) => [normalizarNombre(c.nombre), c]));
  const categoriaPorNombre = new Map(categorias.map((c) => [normalizarNombre(c.nombre), c]));

  /** La tasa que estaba vigente en esa fecha, para no distorsionar el histórico. */
  const tasaEn = (fecha: Date): number | null => {
    let elegida: number | null = null;
    for (const t of tasas) {
      if (t.fecha <= fecha) elegida = aNumero(t.valorBsPorUsd);
      else break;
    }
    // Antes de la primera tasa registrada, usamos esa primera como aproximación.
    if (elegida === null && tasas.length > 0) elegida = aNumero(tasas[0].valorBsPorUsd);
    return elegida;
  };

  const erroresTotales = [...errores];
  const aInsertar: {
    usuarioId: string;
    cuentaId: string;
    categoriaId: string | null;
    tipo: "INGRESO" | "GASTO";
    monto: number;
    moneda: Moneda;
    tasaCambioAplicada: number | null;
    fecha: Date;
    nota: string | null;
  }[] = [];
  const deltaPorCuenta = new Map<string, number>();

  for (const m of movimientos) {
    if (m.tipo === "TRANSFERENCIA") {
      // Una transferencia necesita cuenta destino y el archivo no la trae.
      erroresTotales.push({
        fila: m.fila,
        motivo: "Las transferencias hay que registrarlas a mano (falta la cuenta destino)",
      });
      continue;
    }

    const cuenta = m.nombreCuenta
      ? (cuentaPorNombre.get(normalizarNombre(m.nombreCuenta)) ?? cuentaPorDefecto)
      : cuentaPorDefecto;

    const categoria = m.nombreCategoria
      ? (categoriaPorNombre.get(normalizarNombre(m.nombreCategoria)) ?? null)
      : null;
    if (m.nombreCategoria && !categoria) {
      // No es un error que corte la fila: se importa sin categoría y se avisa.
      erroresTotales.push({
        fila: m.fila,
        motivo: "Categoría no encontrada, se importó sin categoría",
        valor: m.nombreCategoria,
      });
    }

    const tasa = tasaEn(m.fecha);
    let enMonedaCuenta: number;
    try {
      enMonedaCuenta = redondear(convertir(m.monto, m.moneda, cuenta.moneda, tasa));
    } catch {
      erroresTotales.push({
        fila: m.fila,
        motivo: `Sin tasa de cambio para convertir ${m.moneda} a ${cuenta.moneda}`,
      });
      continue;
    }

    aInsertar.push({
      usuarioId,
      cuentaId: cuenta.id,
      categoriaId: categoria?.id ?? null,
      tipo: m.tipo,
      monto: m.monto,
      moneda: m.moneda,
      tasaCambioAplicada: tasa,
      fecha: m.fecha,
      nota: m.nota,
    });

    const delta = m.tipo === "INGRESO" ? enMonedaCuenta : -enMonedaCuenta;
    deltaPorCuenta.set(cuenta.id, redondear((deltaPorCuenta.get(cuenta.id) ?? 0) + delta));
  }

  let omitidosPorDuplicado = 0;
  let finales = aInsertar;

  if (opciones.omitirDuplicados && aInsertar.length > 0) {
    const fechas = aInsertar.map((m) => m.fecha.getTime());
    const existentes = await prisma.movimiento.findMany({
      where: {
        usuarioId,
        fecha: { gte: new Date(Math.min(...fechas)), lte: new Date(Math.max(...fechas)) },
      },
      select: { cuentaId: true, monto: true, fecha: true, tipo: true },
    });
    const clave = (m: { cuentaId: string; monto: number; fecha: Date; tipo: string }) =>
      `${m.cuentaId}|${m.tipo}|${m.fecha.toISOString().slice(0, 10)}|${m.monto.toFixed(2)}`;
    const vistos = new Set(
      existentes.map((m) => clave({ ...m, monto: aNumero(m.monto) })),
    );

    finales = [];
    for (const m of aInsertar) {
      const k = clave(m);
      if (vistos.has(k)) {
        omitidosPorDuplicado++;
        const cuentaId = m.cuentaId;
        const delta = m.tipo === "INGRESO" ? -1 : 1;
        // Deshacemos el delta que ya habíamos acumulado para esta fila.
        const enMonedaCuenta = Math.abs(
          redondear(
            convertir(
              m.monto,
              m.moneda,
              cuentas.find((c) => c.id === cuentaId)!.moneda,
              m.tasaCambioAplicada,
            ),
          ),
        );
        deltaPorCuenta.set(
          cuentaId,
          redondear((deltaPorCuenta.get(cuentaId) ?? 0) + delta * enMonedaCuenta),
        );
        continue;
      }
      vistos.add(k);
      finales.push(m);
    }
  }

  if (finales.length === 0) {
    return { importados: 0, omitidosPorDuplicado, errores: erroresTotales, cuentasAfectadas: [] };
  }

  await prisma.$transaction(async (tx) => {
    await tx.movimiento.createMany({ data: finales });
    for (const [cuentaId, delta] of deltaPorCuenta) {
      if (delta === 0) continue;
      await tx.cuenta.update({
        where: { id: cuentaId },
        data: { saldoActual: { increment: delta } },
      });
    }
  });

  const actualizadas = await prisma.cuenta.findMany({
    where: { id: { in: [...deltaPorCuenta.keys()] } },
    select: { nombre: true, saldoActual: true },
  });

  return {
    importados: finales.length,
    omitidosPorDuplicado,
    errores: erroresTotales,
    cuentasAfectadas: actualizadas.map((c) => ({
      nombre: c.nombre,
      saldoFinal: aNumero(c.saldoActual),
    })),
  };
}

export function validarMapeo(mapeo: Mapeo, columnas: string[]) {
  for (const campo of ["fecha", "monto"] as const) {
    if (!mapeo[campo]) {
      throw new ReglaNegocioError(`Falta indicar qué columna tiene la ${campo}`, campo);
    }
    if (!columnas.includes(mapeo[campo])) {
      throw new ReglaNegocioError(`La columna "${mapeo[campo]}" no está en el archivo`, campo);
    }
  }
}
