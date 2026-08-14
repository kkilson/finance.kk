import { conUsuario, json } from "@/lib/api";
import { calcularProyeccionMes } from "@/lib/calculos/proyeccion-mes";
import { mesPeriodoSchema } from "@/lib/schemas";

export const GET = conUsuario(async (usuarioId, req: Request) => {
  const mes = new URL(req.url).searchParams.get("mes");
  const periodo = mes ? mesPeriodoSchema.parse(mes) : undefined;
  return json(await calcularProyeccionMes(usuarioId, periodo));
});
