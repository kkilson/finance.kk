import { conUsuario, json } from "@/lib/api";
import { mesPeriodoDe } from "@/lib/periodo";
import { mesPeriodoSchema } from "@/lib/schemas";
import { marcarAtrasados, resumenPresupuesto } from "@/lib/servicios/presupuesto";

export const GET = conUsuario(async (usuarioId, req: Request) => {
  const mes = new URL(req.url).searchParams.get("mes");
  const periodo = mes ? mesPeriodoSchema.parse(mes) : mesPeriodoDe(new Date());
  await marcarAtrasados(usuarioId);
  return json(await resumenPresupuesto(usuarioId, periodo));
});
