import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError, ReglaNegocioError } from "@/lib/api";
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

/**
 * Sin `?forzar=true` archiva la cuenta si tiene movimientos, que es lo que uno
 * quiere el 99% de las veces. Con `forzar` la borra de verdad, arrastrando sus
 * movimientos: irreversible, y por eso la UI lo pide con confirmación aparte.
 */
export const DELETE = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const forzar = new URL(req.url).searchParams.get("forzar") === "true";

  const movimientos = await prisma.movimiento.count({
    where: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] },
  });

  if (movimientos > 0 && !forzar) {
    const cuenta = await prisma.cuenta.update({ where: { id }, data: { activa: false } });
    return json({ archivada: true, cuenta, movimientos });
  }

  if (movimientos > 0) {
    const pagos = await prisma.pagoDeuda.count({
      where: { movimiento: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] } },
    });
    if (pagos > 0) {
      throw new ReglaNegocioError(
        "Esta cuenta tiene pagos de deudas asociados. Deshazlos primero en Deudas, " +
          "si no la deuda quedaría con un saldo que no corresponde",
      );
    }
  }

  await prisma.$transaction([
    prisma.movimiento.deleteMany({ where: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] } }),
    prisma.cuenta.delete({ where: { id } }),
  ]);
  return json({ eliminada: true, movimientosEliminados: movimientos });
});
