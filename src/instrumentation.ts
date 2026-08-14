/**
 * Fija la zona horaria del proceso al arrancar.
 *
 * Vercel no deja definir `TZ` (es un nombre reservado), así que la leemos de
 * `APP_TZ` y se la asignamos a `TZ` en caliente — Node vuelve a leerla al
 * asignarla. Sin esto el runtime corre en UTC, y en Venezuela (UTC-4) eso no
 * solo corre las franjas horarias de las notificaciones: entre las 20:00 y la
 * medianoche cambia el *día*, y con él el mes del presupuesto, los días de
 * cobertura y qué compromisos cuentan como vencidos.
 */
export async function register() {
  const zona = process.env.APP_TZ ?? process.env.TZ;
  if (!zona) {
    console.warn("APP_TZ no está definida: el proceso usa la zona horaria del sistema");
    return;
  }
  if (process.env.TZ !== zona) {
    process.env.TZ = zona;
  }
  console.log(`Zona horaria del proceso: ${zona} (${new Date().toString().slice(0, 33)})`);
}
