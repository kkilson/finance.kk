import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody, NoEncontradoError } from "@/lib/api";
import { categoriaEditarSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function propia(usuarioId: string, id: string) {
  const categoria = await prisma.categoria.findFirst({ where: { id, usuarioId } });
  if (!categoria) throw new NoEncontradoError("Categoría");
  return categoria;
}

export const GET = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await propia(usuarioId, id));
});

export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const datos = await leerBody(req, categoriaEditarSchema);
  const categoria = await prisma.categoria.update({ where: { id }, data: datos });
  return json(categoria);
});

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await propia(usuarioId, id);
  const enUso = await prisma.movimiento.count({ where: { categoriaId: id } });
  if (enUso > 0) {
    // Igual que con las cuentas: archivar en vez de borrar para no perder histórico.
    const categoria = await prisma.categoria.update({ where: { id }, data: { archivada: true } });
    return json({ archivada: true, categoria });
  }
  await prisma.categoria.delete({ where: { id } });
  return json({ eliminada: true });
});
