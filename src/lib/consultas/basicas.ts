import { prisma } from "@/lib/prisma";
import { serializar } from "@/lib/api";
import type { CategoriaDTO, CuentaDTO, MovimientoDTO, TasaCambioDTO } from "@/types";

export async function listarCuentas(usuarioId: string): Promise<CuentaDTO[]> {
  return serializar(
    await prisma.cuenta.findMany({
      where: { usuarioId },
      orderBy: [{ activa: "desc" }, { favorita: "desc" }, { nombre: "asc" }],
    }),
  ) as unknown as CuentaDTO[];
}

export async function listarCategorias(usuarioId: string): Promise<CategoriaDTO[]> {
  return serializar(
    await prisma.categoria.findMany({
      where: { usuarioId, archivada: false },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    }),
  ) as unknown as CategoriaDTO[];
}

export async function listarMovimientos(usuarioId: string, limite = 100): Promise<MovimientoDTO[]> {
  return serializar(
    await prisma.movimiento.findMany({
      where: { usuarioId },
      include: { cuenta: true, categoria: true, cuentaDestino: true },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      take: limite,
    }),
  ) as unknown as MovimientoDTO[];
}

export async function listarTasas(): Promise<{
  vigente: TasaCambioDTO | null;
  historial: TasaCambioDTO[];
}> {
  const historial = serializar(
    await prisma.tasaCambio.findMany({ orderBy: { fecha: "desc" }, take: 30 }),
  ) as unknown as TasaCambioDTO[];
  return { vigente: historial[0] ?? null, historial };
}
