import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { hechosPendientes } from "./evaluador";
import type { HechoNotificable } from "./reglas";

let configurado = false;

/** Devuelve false si faltan las llaves VAPID (entorno sin push configurado). */
function configurarVapid(): boolean {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contacto = process.env.VAPID_SUBJECT ?? "mailto:rumbo@localhost";
  if (!publica || !privada) return false;
  if (!configurado) {
    webpush.setVapidDetails(contacto, publica, privada);
    configurado = true;
  }
  return true;
}

export interface ResultadoEnvio {
  evaluados: number;
  enviados: number;
  fallidos: number;
  sinDispositivos: boolean;
}

/**
 * Evalúa las reglas de un usuario y manda lo que corresponda a sus dispositivos.
 * Registra cada notificación aunque el envío falle: así la clave de dedup evita
 * que el cron reintente en bucle el mismo aviso cada hora.
 */
export async function notificarUsuario(
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<ResultadoEnvio> {
  const hechos = await hechosPendientes(usuarioId, hoy);
  if (hechos.length === 0) {
    return { evaluados: 0, enviados: 0, fallidos: 0, sinDispositivos: false };
  }

  const dispositivos = await prisma.dispositivoPush.findMany({
    where: { usuarioId, activo: true, plataforma: "WEB" },
  });

  if (dispositivos.length === 0 || !configurarVapid()) {
    // Sin dispositivos o sin VAPID igual dejamos constancia, para que el
    // historial en Ajustes muestre qué se habría avisado.
    await registrar(usuarioId, hechos, null, "Sin dispositivo suscrito o VAPID sin configurar");
    return {
      evaluados: hechos.length,
      enviados: 0,
      fallidos: 0,
      sinDispositivos: true,
    };
  }

  let enviados = 0;
  let fallidos = 0;

  for (const hecho of hechos) {
    for (const d of dispositivos) {
      try {
        await webpush.sendNotification(
          {
            endpoint: d.endpoint,
            keys: { p256dh: d.claveP256dh ?? "", auth: d.claveAuth ?? "" },
          },
          JSON.stringify({
            titulo: hecho.titulo,
            cuerpo: hecho.cuerpo,
            url: urlDeRegla(hecho),
          }),
        );
        enviados++;
        await prisma.dispositivoPush.update({
          where: { id: d.id },
          data: { ultimoUso: new Date() },
        });
        await registrarUno(usuarioId, hecho, d.id, null);
      } catch (e) {
        fallidos++;
        const err = e as { statusCode?: number; message?: string };
        // 404/410 = suscripción muerta (navegador desinstalado, permiso revocado).
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.dispositivoPush.update({
            where: { id: d.id },
            data: { activo: false },
          });
        }
        await registrarUno(usuarioId, hecho, d.id, err.message ?? "Error al enviar");
      }
    }
  }

  return { evaluados: hechos.length, enviados, fallidos, sinDispositivos: false };
}

function urlDeRegla(hecho: HechoNotificable): string {
  switch (hecho.regla) {
    case "PAGO_POR_VENCER":
    case "PAGO_ATRASADO":
    case "INGRESO_ESPERADO_HOY":
    case "CUOTA_BNPL_POR_VENCER":
      return "/presupuesto";
    case "TARJETA_CERCA_DEL_LIMITE":
    case "CAPACIDAD_EXCEDIDA":
      return "/deudas";
    default:
      return "/dashboard";
  }
}

async function registrarUno(
  usuarioId: string,
  hecho: HechoNotificable,
  dispositivoId: string | null,
  error: string | null,
) {
  // upsert por la clave única (usuarioId, claveDedup): con varios dispositivos
  // el segundo envío no debe reventar por duplicado.
  await prisma.notificacionEnviada.upsert({
    where: { usuarioId_claveDedup: { usuarioId, claveDedup: hecho.claveDedup } },
    update: { entregada: error === null, error, dispositivoId },
    create: {
      usuarioId,
      regla: hecho.regla,
      titulo: hecho.titulo,
      cuerpo: hecho.cuerpo,
      claveDedup: hecho.claveDedup,
      entregada: error === null,
      error,
      dispositivoId,
    },
  });
}

async function registrar(
  usuarioId: string,
  hechos: HechoNotificable[],
  dispositivoId: string | null,
  error: string | null,
) {
  for (const h of hechos) await registrarUno(usuarioId, h, dispositivoId, error);
}

/** Corre la evaluación para todos los usuarios. Lo que invoca el cron. */
export async function notificarATodos(hoy: Date = new Date()) {
  const usuarios = await prisma.usuario.findMany({ select: { id: true } });
  const resultados = [];
  for (const u of usuarios) {
    resultados.push({ usuarioId: u.id, ...(await notificarUsuario(u.id, hoy)) });
  }
  return resultados;
}
