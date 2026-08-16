import { conUsuario, json } from "@/lib/api";
import { eliminarPagoDeuda } from "@/lib/servicios/deudas";

type Ctx = { params: Promise<{ id: string; pagoId: string }> };

export const DELETE = conUsuario(async (usuarioId, _req: Request, ctx: Ctx) => {
  const { id, pagoId } = await ctx.params;
  return json(await eliminarPagoDeuda(usuarioId, id, pagoId));
});
