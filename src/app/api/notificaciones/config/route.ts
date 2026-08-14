import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conUsuario, json, leerBody } from "@/lib/api";
import { PARAMETRO_DEFAULT, TODAS_LAS_REGLAS } from "@/lib/notificaciones/reglas";

const reglaSchema = z.enum(TODAS_LAS_REGLAS as [string, ...string[]]);

const editarSchema = z.object({
  regla: reglaSchema,
  activa: z.boolean().optional(),
  parametro: z.number().min(0).nullish(),
  horaDesde: z.number().int().min(0).max(23).optional(),
  horaHasta: z.number().int().min(0).max(23).optional(),
});

/** Devuelve las 8 reglas, con su configuración guardada o los valores por defecto. */
export const GET = conUsuario(async (usuarioId) => {
  const guardadas = await prisma.notificacionConfig.findMany({ where: { usuarioId } });
  const porRegla = new Map(guardadas.map((c) => [c.regla, c]));
  return json(
    TODAS_LAS_REGLAS.map((regla) => {
      const c = porRegla.get(regla);
      return {
        regla,
        activa: c?.activa ?? true,
        parametro: c?.parametro !== undefined && c?.parametro !== null
          ? Number(c.parametro.toString())
          : PARAMETRO_DEFAULT[regla],
        horaDesde: c?.horaDesde ?? 8,
        horaHasta: c?.horaHasta ?? 21,
      };
    }),
  );
});

export const PATCH = conUsuario(async (usuarioId, req: Request) => {
  const { regla, ...cambios } = await leerBody(req, editarSchema);
  const tipoRegla = regla as (typeof TODAS_LAS_REGLAS)[number];
  const config = await prisma.notificacionConfig.upsert({
    where: { usuarioId_regla: { usuarioId, regla: tipoRegla } },
    update: cambios,
    create: {
      usuarioId,
      regla: tipoRegla,
      activa: cambios.activa ?? true,
      parametro: cambios.parametro ?? PARAMETRO_DEFAULT[tipoRegla],
      horaDesde: cambios.horaDesde ?? 8,
      horaHasta: cambios.horaHasta ?? 21,
    },
  });
  return json(config);
});
