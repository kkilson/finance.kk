import { conUsuario, json } from "@/lib/api";
import { calcularCapacidadEndeudamiento } from "@/lib/calculos/capacidad-endeudamiento";

export const GET = conUsuario(async (usuarioId) => {
  return json(await calcularCapacidadEndeudamiento(usuarioId));
});
