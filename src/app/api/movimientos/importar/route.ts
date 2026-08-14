import { z } from "zod";
import { conUsuario, json, leerBody } from "@/lib/api";
import { monedaSchema, tipoMovimientoSchema } from "@/lib/schemas";
import { MAX_FILAS } from "@/lib/servicios/parseo-archivo";
import { importarMovimientos, validarMapeo } from "@/lib/servicios/importar-movimientos";

// Importar miles de filas puede pasarse del default de 10s.
export const maxDuration = 60;

const mapeoSchema = z.object({
  fecha: z.string().min(1),
  monto: z.string().min(1),
  tipo: z.string().nullish(),
  categoria: z.string().nullish(),
  cuenta: z.string().nullish(),
  moneda: z.string().nullish(),
  nota: z.string().nullish(),
});

const importarSchema = z.object({
  filas: z.array(z.record(z.string(), z.string())).min(1).max(MAX_FILAS),
  mapeo: mapeoSchema,
  cuentaPorDefectoId: z.string().min(1, "Elige la cuenta a la que van los movimientos"),
  tipoPorDefecto: tipoMovimientoSchema.default("GASTO"),
  monedaPorDefecto: monedaSchema,
  signoDefineTipo: z.boolean().default(true),
  formatoLatino: z.boolean().default(true),
  omitirDuplicados: z.boolean().default(true),
});

/** Paso 2: confirmar el mapeo y escribir. */
export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, importarSchema);
  validarMapeo(datos.mapeo, Object.keys(datos.filas[0] ?? {}));

  return json(
    await importarMovimientos(usuarioId, datos.filas, datos.mapeo, {
      tipoPorDefecto: datos.tipoPorDefecto,
      monedaPorDefecto: datos.monedaPorDefecto,
      signoDefineTipo: datos.signoDefineTipo,
      formatoLatino: datos.formatoLatino,
      cuentaPorDefectoId: datos.cuentaPorDefectoId,
      omitirDuplicados: datos.omitirDuplicados,
    }),
    201,
  );
});
