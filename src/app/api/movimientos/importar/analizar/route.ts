import { conUsuario, json, ReglaNegocioError } from "@/lib/api";
import { parsearArchivo } from "@/lib/servicios/parseo-archivo";
import { sugerirMapeo } from "@/lib/servicios/importacion";

// Vercel corta el cuerpo de una función serverless en 4.5 MB, así que pedir
// más que eso solo produce un error opaco del proxy en vez de uno nuestro.
const MAX_BYTES = 4 * 1024 * 1024;

/** Paso 1: leer el archivo y proponer un mapeo de columnas. No escribe nada. */
export const POST = conUsuario(async (_usuarioId, req: Request) => {
  const form = await req.formData();
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    throw new ReglaNegocioError("Falta el archivo", "archivo");
  }
  if (archivo.size > MAX_BYTES) {
    throw new ReglaNegocioError("El archivo pesa más de 4 MB", "archivo");
  }

  const { columnas, filas, truncado } = await parsearArchivo(
    archivo.name,
    await archivo.arrayBuffer(),
  );

  return json({
    columnas,
    filas,
    truncado,
    totalFilas: filas.length,
    sugerencia: sugerirMapeo(columnas),
  });
});
