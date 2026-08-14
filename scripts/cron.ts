import "dotenv/config";
import cron from "node-cron";

/**
 * Worker del job horario (sección 9 de la spec). Corre en su propio proceso
 * —el contenedor `cron` del compose— y golpea el endpoint protegido, para que
 * la lógica viva en un solo sitio y no se duplique acá.
 */
const URL_BASE = process.env.CRON_TARGET_URL ?? "http://app:3000";
const SECRETO = process.env.CRON_SECRET;
const EXPRESION = process.env.CRON_SCHEDULE ?? "0 * * * *"; // cada hora en punto

if (!SECRETO) {
  console.error("Falta CRON_SECRET");
  process.exit(1);
}

async function ejecutar() {
  const inicio = new Date().toISOString();
  try {
    const res = await fetch(`${URL_BASE}/api/cron/notificaciones`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRETO}` },
    });
    const cuerpo = await res.text();
    console.log(`[${inicio}] ${res.status} ${cuerpo}`);
  } catch (e) {
    console.error(`[${inicio}] falló:`, (e as Error).message);
  }
}

cron.schedule(EXPRESION, ejecutar);
console.log(`Cron de notificaciones activo (${EXPRESION}) apuntando a ${URL_BASE}`);

// Una corrida al arrancar, para no esperar hasta la hora en punto.
void ejecutar();
