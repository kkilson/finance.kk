import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { NavPrincipal } from "@/components/nav-principal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <NavPrincipal moneda={usuario.monedaReferenciaDefault} />
      <main className="max-w-[1180px] flex-1 px-4 pb-24 pt-5 lg:px-[34px] lg:pb-[60px] lg:pt-[26px]">
        {children}
      </main>
    </div>
  );
}
