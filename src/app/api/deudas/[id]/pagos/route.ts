import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { pagoDeudaSchema } from "@/lib/schemas";
import { registrarPagoDeuda } from "@/lib/servicios/deudas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const deuda = await prisma.deudaPrestamo.findFirst({ where: { id, usuarioId } });
  if (!deuda) throw new NoEncontradoError("Deuda");
  return json(
    await prisma.pagoDeuda.findMany({
      where: { deudaId: id },
      include: { movimiento: { include: { cuenta: true } } },
      orderBy: { fecha: "desc" },
    }),
  );
});

export const POST = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const datos = await leerBody(req, pagoDeudaSchema);
  return json(await registrarPagoDeuda(usuarioId, id, datos), 201);
});
