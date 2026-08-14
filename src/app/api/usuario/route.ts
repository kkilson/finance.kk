import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { monedaSchema } from "@/lib/schemas";

const editarSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  monedaReferenciaDefault: monedaSchema.optional(),
  saldoMinimoSeguridad: z.number().min(0).optional(),
  umbralEndeudamiento: z.number().min(0).max(1).optional(),
  pctPagoMinimoTarjeta: z.number().min(0).max(1).optional(),
});

const publico = {
  id: true,
  nombre: true,
  email: true,
  monedaReferenciaDefault: true,
  saldoMinimoSeguridad: true,
  umbralEndeudamiento: true,
  pctPagoMinimoTarjeta: true,
} as const;

export const GET = conUsuario(async (usuarioId) => {
  return json(await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: publico }));
});

export const PATCH = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, editarSchema);
  return json(
    await prisma.usuario.update({ where: { id: usuarioId }, data: datos, select: publico }),
  );
});
