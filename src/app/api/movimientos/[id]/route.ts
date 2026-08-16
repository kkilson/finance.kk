import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { movimientoEditarSchema } from "@/lib/schemas";
import { actualizarMovimiento, eliminarMovimiento } from "@/lib/servicios/movimientos";

type Ctx = { params: Promise<{ id: string }> };

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const mov = await prisma.movimiento.findFirst({
    where: { id, usuarioId },
    include: { cuenta: true, categoria: true, cuentaDestino: true },
  });
  if (!mov) throw new NoEncontradoError("Movimiento");
  return json(mov);
});

/** Edita el movimiento recalculando los saldos afectados. */
export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const datos = await leerBody(req, movimientoEditarSchema);
  return json(await actualizarMovimiento(usuarioId, id, datos));
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await eliminarMovimiento(usuarioId, id));
});
