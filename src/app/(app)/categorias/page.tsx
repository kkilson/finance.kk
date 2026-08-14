import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";
import { listarCategorias } from "@/lib/consultas/basicas";
import { CategoriasCliente } from "./categorias-cliente";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");
  return <CategoriasCliente categorias={await listarCategorias(usuarioId)} />;
}
