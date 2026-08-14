import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";
import { listarCuentas } from "@/lib/consultas/basicas";
import { aNumero } from "@/lib/moneda";
import { prisma } from "@/lib/prisma";
import { CuentasCliente } from "./cuentas-cliente";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const [cuentas, usuario, tasaRow] = await Promise.all([
    listarCuentas(usuarioId),
    prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } }),
    prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } }),
  ]);

  return (
    <CuentasCliente
      cuentas={cuentas}
      monedaReferencia={usuario.monedaReferenciaDefault}
      tasa={tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null}
    />
  );
}
