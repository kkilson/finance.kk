import { redirect } from "next/navigation";
import { serializar } from "@/lib/api";
import { usuarioIdActual } from "@/lib/auth";
import { listarCategorias, listarCuentas } from "@/lib/consultas/basicas";
import { mesPeriodoDe } from "@/lib/periodo";
import { REGEX_MES_PERIODO } from "@/lib/periodo";
import { marcarAtrasados, resumenPresupuesto } from "@/lib/servicios/presupuesto";
import type { PresupuestoDTO } from "@/types";
import { PresupuestoCliente } from "./presupuesto-cliente";

export const dynamic = "force-dynamic";

export default async function PresupuestoPage({ searchParams }: PageProps<"/presupuesto">) {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const { mes } = await searchParams;
  const periodo =
    typeof mes === "string" && REGEX_MES_PERIODO.test(mes) ? mes : mesPeriodoDe(new Date());

  await marcarAtrasados(usuarioId);
  const [presupuesto, cuentas, categorias] = await Promise.all([
    resumenPresupuesto(usuarioId, periodo),
    listarCuentas(usuarioId),
    listarCategorias(usuarioId),
  ]);

  return (
    <PresupuestoCliente
      presupuesto={serializar(presupuesto) as unknown as PresupuestoDTO}
      cuentas={cuentas.filter((c) => c.activa)}
      categorias={categorias}
    />
  );
}
