import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";

const suscribirSchema = z.object({
  endpoint: z.string().url("Endpoint inválido"),
  claveP256dh: z.string().min(1),
  claveAuth: z.string().min(1),
  etiqueta: z.string().nullish(),
  plataforma: z.enum(["WEB", "ANDROID", "IOS"]).default("WEB"),
});

const bajaSchema = z.object({ endpoint: z.string().url() });

export const GET = conUsuario(async (usuarioId) => {
  return json(
    await prisma.dispositivoPush.findMany({
      where: { usuarioId },
      orderBy: { createdAt: "desc" },
    }),
  );
});

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, suscribirSchema);
  // El navegador puede reenviar la misma suscripción; la reactivamos en vez
  // de acumular filas muertas.
  const dispositivo = await prisma.dispositivoPush.upsert({
    where: { endpoint: datos.endpoint },
    update: {
      usuarioId,
      claveP256dh: datos.claveP256dh,
      claveAuth: datos.claveAuth,
      etiqueta: datos.etiqueta ?? null,
      activo: true,
    },
    create: {
      usuarioId,
      endpoint: datos.endpoint,
      claveP256dh: datos.claveP256dh,
      claveAuth: datos.claveAuth,
      etiqueta: datos.etiqueta ?? null,
      plataforma: datos.plataforma,
    },
  });
  return json(dispositivo, 201);
});

export const DELETE = conUsuario(async (usuarioId, req: Request) => {
  const { endpoint } = await leerBody(req, bajaSchema);
  await prisma.dispositivoPush.updateMany({
    where: { usuarioId, endpoint },
    data: { activo: false },
  });
  return json({ ok: true });
});
