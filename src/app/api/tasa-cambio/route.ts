import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { tasaCambioCrearSchema } from "@/lib/schemas";

export const GET = conUsuario(async () => {
  const vigente = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const historial = await prisma.tasaCambio.findMany({
    orderBy: { fecha: "desc" },
    take: 30,
  });
  return json({ vigente, historial });
});

export const POST = conUsuario(async (_usuarioId, req: Request) => {
  const datos = await leerBody(req, tasaCambioCrearSchema);
  const tasa = await prisma.tasaCambio.create({
    data: {
      valorBsPorUsd: datos.valorBsPorUsd,
      fuente: datos.fuente,
      ...(datos.fecha ? { fecha: datos.fecha } : {}),
    },
  });
  return json(tasa, 201);
});
