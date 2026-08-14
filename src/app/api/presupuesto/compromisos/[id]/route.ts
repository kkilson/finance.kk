import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError, ReglaNegocioError } from "@/lib/api";
import { mesPeriodoDe } from "@/lib/periodo";
import { compromisoEditarSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function propio(usuarioId: string, id: string) {
  const c = await prisma.compromisoPresupuesto.findFirst({
    where: { id, usuarioId },
    include: { movimiento: true },
  });
  if (!c) throw new NoEncontradoError("Compromiso");
  return c;
}

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await propio(usuarioId, id));
});

export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propio(usuarioId, id);
  const datos = await leerBody(req, compromisoEditarSchema);
  const compromiso = await prisma.compromisoPresupuesto.update({
    where: { id },
    data: {
      ...datos,
      // Mover la fecha puede cambiar el mes al que pertenece.
      ...(datos.fechaEsperada ? { mesPeriodo: mesPeriodoDe(datos.fechaEsperada) } : {}),
    },
    include: { categoria: true, deuda: true },
  });
  return json(compromiso);
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const compromiso = await propio(usuarioId, id);
  if (compromiso.movimiento) {
    throw new ReglaNegocioError(
      "Este compromiso ya tiene un movimiento asociado; elimina primero ese movimiento",
    );
  }
  await prisma.compromisoPresupuesto.delete({ where: { id } });
  return json({ eliminado: true });
});
