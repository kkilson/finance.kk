import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { movimientoCrearSchema } from "@/lib/schemas";
import { crearMovimiento } from "@/lib/servicios/movimientos";

export const GET = conUsuario(async (usuarioId, req: Request) => {
  const url = new URL(req.url);
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  const cuentaId = url.searchParams.get("cuentaId");
  const categoriaId = url.searchParams.get("categoriaId");
  const tipo = url.searchParams.get("tipo");
  const limite = Math.min(Number(url.searchParams.get("limite") ?? 100) || 100, 500);

  const movimientos = await prisma.movimiento.findMany({
    where: {
      usuarioId,
      ...(cuentaId ? { OR: [{ cuentaId }, { cuentaDestinoId: cuentaId }] } : {}),
      ...(categoriaId ? { categoriaId } : {}),
      ...(tipo ? { tipo: tipo as "INGRESO" | "GASTO" | "TRANSFERENCIA" } : {}),
      ...(desde || hasta
        ? {
            fecha: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lte: new Date(hasta) } : {}),
            },
          }
        : {}),
    },
    include: { cuenta: true, categoria: true, cuentaDestino: true },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: limite,
  });
  return json(movimientos);
});

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, movimientoCrearSchema);
  const movimiento = await crearMovimiento(usuarioId, datos);
  return json(movimiento, 201);
});
