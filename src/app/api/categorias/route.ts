import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { categoriaCrearSchema, tipoCategoriaSchema } from "@/lib/schemas";

export const GET = conUsuario(async (usuarioId, req: Request) => {
  const url = new URL(req.url);
  const tipoParam = url.searchParams.get("tipo");
  const incluirArchivadas = url.searchParams.get("archivadas") === "true";
  const tipo = tipoParam ? tipoCategoriaSchema.parse(tipoParam) : undefined;

  const categorias = await prisma.categoria.findMany({
    where: {
      usuarioId,
      ...(tipo ? { tipo } : {}),
      ...(incluirArchivadas ? {} : { archivada: false }),
    },
    orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
  });
  return json(categorias);
});

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, categoriaCrearSchema);
  const categoria = await prisma.categoria.create({
    data: {
      usuarioId,
      nombre: datos.nombre,
      tipo: datos.tipo,
      grupoId: datos.grupoId ?? null,
      icono: datos.icono ?? null,
      color: datos.color ?? null,
      esRecurrenteDefault: datos.esRecurrenteDefault,
    },
  });
  return json(categoria, 201);
});
