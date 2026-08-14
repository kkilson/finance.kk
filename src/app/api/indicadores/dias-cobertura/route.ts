import { conUsuario, json } from "@/lib/api";
import { calcularDiasCobertura } from "@/lib/calculos/dias-cobertura";

export const GET = conUsuario(async (usuarioId) => {
  return json(await calcularDiasCobertura(usuarioId));
});
