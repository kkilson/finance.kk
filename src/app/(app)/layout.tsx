import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { NavPrincipal } from "@/components/nav-principal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <NavPrincipal moneda={usuario.monedaReferenciaDefault} />
      {/* El padding acá es el que compensan los márgenes negativos de la
          cabecera degradada del dashboard; si cambia uno, cambia el otro. */}
      <main className="w-full max-w-[1180px] flex-1 overflow-x-hidden px-4 pb-28 pt-5 lg:px-8 lg:pb-14 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
