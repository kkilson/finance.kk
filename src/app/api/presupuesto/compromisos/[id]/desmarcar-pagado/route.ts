import { conUsuario, json } from "@/lib/api";
import { desmarcarCompromisoPagado } from "@/lib/servicios/presupuesto";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await desmarcarCompromisoPagado(usuarioId, id));
});
