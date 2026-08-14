import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { cuentaCrearSchema } from "@/lib/schemas";

export const GET = conUsuario(async (usuarioId) => {
  const cuentas = await prisma.cuenta.findMany({
    where: { usuarioId },
    orderBy: [{ activa: "desc" }, { favorita: "desc" }, { nombre: "asc" }],
  });
  return json(cuentas);
});

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, cuentaCrearSchema);
  const cuenta = await prisma.cuenta.create({
    data: { ...datos, usuarioId },
  });
  return json(cuenta, 201);
});
