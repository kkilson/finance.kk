import { errorJson, json, manejarError } from "@/lib/api";
import { notificarATodos } from "@/lib/notificaciones/enviar";

// El job puede tardar más que el default de 10s si hay varias reglas que evaluar.
export const maxDuration = 60;

/**
 * Job de notificaciones. No usa sesión: se protege con CRON_SECRET.
 * Vercel Cron lo invoca por GET con `Authorization: Bearer $CRON_SECRET`;
 * el worker de docker-compose lo invoca por POST con la misma cabecera.
 */
async function ejecutar(req: Request) {
  try {
    const esperado = process.env.CRON_SECRET;
    if (!esperado) return errorJson("CRON_SECRET no está configurado", 500);
    const enviado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (enviado !== esperado) return errorJson("No autorizado", 401);

    // Las franjas horarias de cada regla se evalúan con la hora local del
    // proceso, que fija src/instrumentation.ts a partir de APP_TZ.
    if (!process.env.APP_TZ) {
      console.warn("APP_TZ no está definida: las franjas horarias pueden evaluarse en UTC");
    }

    return json({ ejecutado: new Date().toISOString(), resultados: await notificarATodos() });
  } catch (e) {
    return manejarError(e);
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
