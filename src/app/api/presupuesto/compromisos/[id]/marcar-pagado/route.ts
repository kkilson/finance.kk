import { conUsuario, json, leerBody } from "@/lib/api";
import { marcarPagadoSchema } from "@/lib/schemas";
import { marcarCompromisoPagado } from "@/lib/servicios/presupuesto";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = conUsuario(async (usuarioId, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const datos = await leerBody(req, marcarPagadoSchema);
  return json(await marcarCompromisoPagado(usuarioId, id, datos));
});
