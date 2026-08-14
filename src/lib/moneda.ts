import type { Moneda } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Prisma devuelve Decimal; toda la capa de cálculo trabaja en number. */
export function aNumero(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Tasa Bs por USD vigente (la más reciente registrada). null si no hay ninguna. */
export async function tasaVigente(): Promise<number | null> {
  const t = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  return t ? aNumero(t.valorBsPorUsd) : null;
}

/**
 * Convierte un monto entre BS y USD usando una tasa Bs/USD dada.
 * Si origen y destino coinciden, devuelve el monto tal cual (no necesita tasa).
 */
export function convertir(
  monto: number,
  desde: Moneda,
  hacia: Moneda,
  tasaBsPorUsd: number | null,
): number {
  if (desde === hacia) return monto;
  if (!tasaBsPorUsd || tasaBsPorUsd <= 0) {
    throw new SinTasaError();
  }
  return desde === "BS" ? monto / tasaBsPorUsd : monto * tasaBsPorUsd;
}

export class SinTasaError extends Error {
  constructor() {
    super("No hay tasa de cambio registrada; registra una en Ajustes o vía POST /api/tasa-cambio");
    this.name = "SinTasaError";
  }
}

export function formatearMonto(monto: number, moneda: Moneda): string {
  const n = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
  return moneda === "USD" ? `$${n}` : `Bs ${n}`;
}
