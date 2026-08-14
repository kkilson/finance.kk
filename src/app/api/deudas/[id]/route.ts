import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { deudaEditarSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function propia(usuarioId: string, id: string) {
  const d = await prisma.deudaPrestamo.findFirst({ where: { id, usuarioId } });
  if (!d) throw new NoEncontradoError("Deuda");
  return d;
}

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  return json(
    await prisma.deudaPrestamo.findUnique({
      where: { id },
      include: {
        pagos: { orderBy: { fecha: "desc" } },
        compromisos: { orderBy: { fechaEsperada: "asc" } },
      },
    }),
  );
});

export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const datos = await leerBody(req, deudaEditarSchema);
  return json(await prisma.deudaPrestamo.update({ where: { id }, data: datos }));
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const pagos = await prisma.pagoDeuda.count({ where: { deudaId: id } });
  if (pagos > 0) {
    // Con pagos registrados, borrar dejaría movimientos huérfanos: la cerramos.
    return json({ cerrada: true, deuda: await prisma.deudaPrestamo.update({ where: { id }, data: { activa: false } }) });
  }
  await prisma.compromisoPresupuesto.deleteMany({ where: { deudaId: id, movimiento: null } });
  await prisma.deudaPrestamo.delete({ where: { id } });
  return json({ eliminada: true });
});
