import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { movimientoEditarSchema } from "@/lib/schemas";
import { eliminarMovimiento } from "@/lib/servicios/movimientos";

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

/**
 * Solo campos que no afectan saldos. Para cambiar monto, cuenta o tipo hay que
 * eliminar y volver a registrar, así el ajuste de saldo pasa siempre por el
 * mismo camino transaccional.
 */
export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const existe = await prisma.movimiento.findFirst({ where: { id, usuarioId } });
  if (!existe) throw new NoEncontradoError("Movimiento");
  const datos = await leerBody(req, movimientoEditarSchema);
  const mov = await prisma.movimiento.update({
    where: { id },
    data: datos,
    include: { cuenta: true, categoria: true, cuentaDestino: true },
  });
  return json(mov);
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await eliminarMovimiento(usuarioId, id));
});
