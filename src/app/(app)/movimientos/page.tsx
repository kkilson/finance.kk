import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";
import { listarCategorias, listarCuentas, listarMovimientos } from "@/lib/consultas/basicas";
import { MovimientosCliente } from "./movimientos-cliente";

export const dynamic = "force-dynamic";

export default async function MovimientosPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const [cuentas, categorias, movimientos] = await Promise.all([
    listarCuentas(usuarioId),
    listarCategorias(usuarioId),
    listarMovimientos(usuarioId),
  ]);

  return (
    <MovimientosCliente
      cuentas={cuentas.filter((c) => c.activa)}
      categorias={categorias}
      movimientos={movimientos}
    />
  );
}
