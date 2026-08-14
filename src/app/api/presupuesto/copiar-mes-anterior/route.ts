import { conUsuario, json, leerBody } from "@/lib/api";
import { copiarMesSchema } from "@/lib/schemas";
import { copiarMesAnterior } from "@/lib/servicios/presupuesto";

export const POST = conUsuario(async (usuarioId, req: Request) => {
  const { mesOrigen, mesDestino } = await leerBody(req, copiarMesSchema);
  return json(await copiarMesAnterior(usuarioId, mesOrigen, mesDestino), 201);
});
