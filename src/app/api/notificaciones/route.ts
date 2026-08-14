import { prisma } from "@/lib/prisma";
import { conUsuario, json } from "@/lib/api";
import { hechosPendientes } from "@/lib/notificaciones/evaluador";
import { notificarUsuario } from "@/lib/notificaciones/enviar";

/** Historial de lo enviado, y lo que se enviaría ahora mismo (para previsualizar). */
export const GET = conUsuario(async (usuarioId, req: Request) => {
  const previsualizar = new URL(req.url).searchParams.get("previsualizar") === "true";
  const [historial, pendientes] = await Promise.all([
    prisma.notificacionEnviada.findMany({
      where: { usuarioId },
      orderBy: { enviadaEn: "desc" },
      take: 30,
    }),
    previsualizar ? hechosPendientes(usuarioId) : Promise.resolve([]),
  ]);
  return json({ historial, pendientes });
});

/** Dispara la evaluación a mano, sin esperar al cron. */
export const POST = conUsuario(async (usuarioId) => {
  return json(await notificarUsuario(usuarioId));
});
