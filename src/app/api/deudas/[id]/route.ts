import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { deudaEditarSchema } from "@/lib/schemas";
import { eliminarPagoDeuda } from "@/lib/servicios/deudas";

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

/**
 * Sin `?forzar=true` una deuda con pagos se cierra en vez de borrarse, para no
 * dejar movimientos huérfanos. Con `forzar` se borra entera: los pagos, los
 * movimientos que los respaldan (devolviendo el dinero a cada cuenta) y las
 * cuotas que quedaran en el presupuesto.
 */
export const DELETE = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const forzar = new URL(req.url).searchParams.get("forzar") === "true";

  const pagos = await prisma.pagoDeuda.findMany({
    where: { deudaId: id },
    select: { id: true },
  });

  if (pagos.length > 0 && !forzar) {
    return json({
      cerrada: true,
      pagos: pagos.length,
      deuda: await prisma.deudaPrestamo.update({ where: { id }, data: { activa: false } }),
    });
  }

  // Deshacer cada pago devuelve saldos y cuotas a su sitio antes de borrar.
  for (const p of pagos) {
    await eliminarPagoDeuda(usuarioId, id, p.id);
  }

  await prisma.$transaction([
    prisma.compromisoPresupuesto.deleteMany({ where: { deudaId: id } }),
    prisma.deudaPrestamo.delete({ where: { id } }),
  ]);
  return json({ eliminada: true, pagosDeshechos: pagos.length });
});
