import { conUsuario, json, leerBody } from "@/lib/api";
import { compromisoCrearSchema } from "@/lib/schemas";
import { crearCompromiso } from "@/lib/servicios/presupuesto";

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const datos = await leerBody(req, compromisoCrearSchema);
  return json(await crearCompromiso(usuarioId, datos), 201);
});
