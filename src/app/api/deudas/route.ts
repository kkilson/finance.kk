import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { deudaCrearSchemaValidado } from "@/lib/schemas";
import { crearDeuda } from "@/lib/servicios/deudas";

export const GET = conUsuario(async (usuarioId, req: Request) => {
  const incluirCerradas = new URL(req.url).searchParams.get("cerradas") === "true";
  const deudas = await prisma.deudaPrestamo.findMany({
    where: { usuarioId, ...(incluirCerradas ? {} : { activa: true }) },
    include: { pagos: { orderBy: { fecha: "desc" }, take: 5 } },
    orderBy: [{ activa: "desc" }, { createdAt: "desc" }],
  });
  return json(deudas);
});

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, deudaCrearSchemaValidado);
  return json(await crearDeuda(usuarioId, datos), 201);
});
