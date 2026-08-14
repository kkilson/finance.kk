import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { cuentaEditarSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function propia(usuarioId: string, id: string) {
  const cuenta = await prisma.cuenta.findFirst({ where: { id, usuarioId } });
  if (!cuenta) throw new NoEncontradoError("Cuenta");
  return cuenta;
}

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await propia(usuarioId, id));
});

export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const datos = await leerBody(req, cuentaEditarSchema);
  const cuenta = await prisma.cuenta.update({ where: { id }, data: datos });
  return json(cuenta);
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const movimientos = await prisma.movimiento.count({
    where: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] },
  });
  if (movimientos > 0) {
    // Borrar rompería el histórico de saldos: la archivamos en su lugar.
    const cuenta = await prisma.cuenta.update({ where: { id }, data: { activa: false } });
    return json({ archivada: true, cuenta });
  }
  await prisma.cuenta.delete({ where: { id } });
  return json({ eliminada: true });
});
