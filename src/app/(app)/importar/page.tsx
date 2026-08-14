import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";
import { listarCuentas } from "@/lib/consultas/basicas";
import { prisma } from "@/lib/prisma";
import { ImportarCliente } from "./importar-cliente";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const [cuentas, usuario] = await Promise.all([
    listarCuentas(usuarioId),
    prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } }),
  ]);

  return (
    <ImportarCliente
      cuentas={cuentas.filter((c) => c.activa)}
      monedaPorDefecto={usuario.monedaReferenciaDefault}
    />
  );
}
