"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/lib/cliente-api";
import type { Moneda } from "@/types";

const ENLACES = [
  { href: "/dashboard", label: "Dashboard", icono: <IconoDashboard /> },
  { href: "/movimientos", label: "Movimientos", icono: <IconoMovimientos /> },
  { href: "/presupuesto", label: "Presupuesto", icono: <IconoCalendario /> },
  { href: "/cuentas", label: "Cuentas", icono: <IconoTarjeta /> },
  { href: "/deudas", label: "Deudas y préstamos", icono: <IconoDeudas /> },
  { href: "/categorias", label: "Categorías", icono: <IconoCategorias /> },
  { href: "/importar", label: "Importar", icono: <IconoImportar /> },
  { href: "/ajustes", label: "Ajustes", icono: <IconoAjustes /> },
];

export function NavPrincipal({ moneda }: { moneda: Moneda }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [monedaActual, setMonedaActual] = useState<Moneda>(moneda);

  async function cambiarMoneda(nueva: Moneda) {
    if (nueva === monedaActual) return;
    setMonedaActual(nueva);
    await api.patch("/api/usuario", { monedaReferenciaDefault: nueva });
    startTransition(() => router.refresh());
  }

  return (
    <>
      <aside className="hidden w-[220px] shrink-0 flex-col bg-teal-deep px-3.5 py-[22px] text-[#EAF3F1] lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-[22px]">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-linear-to-br from-gold to-[#E8C066]">
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
              <path
                d="M4 18L10 10L14 14L20 6"
                stroke="#0A3A3E"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="font-display text-[17px] font-bold tracking-[-0.01em]">Rumbo</div>
            <div className="-mt-0.5 text-[11px] text-[#9FC2BE]">finanzas personales</div>
          </div>
        </div>

        <nav className="mt-1.5 flex flex-col gap-[3px]">
          {ENLACES.map((e) => {
            const activo = pathname.startsWith(e.href);
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition ${
                  activo
                    ? "bg-gold font-semibold text-teal-deep"
                    : "text-[#C7DEDB] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className={`shrink-0 ${activo ? "opacity-100" : "opacity-85"}`}>
                  {e.icono}
                </span>
                {e.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 px-2.5 pb-1 pt-3.5">
          <div className="mb-2 text-[11px] text-[#9FC2BE]">Moneda de referencia</div>
          <div className="flex gap-1.5">
            {(["USD", "BS"] as Moneda[]).map((m) => (
              <button
                key={m}
                onClick={() => cambiarMoneda(m)}
                className={`flex-1 rounded-lg border py-[7px] text-[12px] font-semibold ${
                  monedaActual === m
                    ? "border-transparent bg-white/[0.12] text-white"
                    : "border-white/15 text-[#9FC2BE]"
                }`}
              >
                {m === "USD" ? "USD" : "Bs"}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Barra inferior en pantallas donde el sidebar se oculta */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface lg:hidden">
        {ENLACES.slice(0, 5).map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] ${
              pathname.startsWith(e.href) ? "text-teal" : "text-ink-soft"
            }`}
          >
            {e.icono}
            {e.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </>
  );
}

const svg = "h-[17px] w-[17px]";

function IconoDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconoMovimientos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconoTarjeta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoDeudas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <path d="M12 2v20M17 5.5C17 4 14.8 3 12 3s-5 1.2-5 3 2 2.6 5 3.3 5 2 5 3.4-2.2 3.3-5 3.3-5-1-5-2.5" />
    </svg>
  );
}

function IconoCategorias() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function IconoImportar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <path d="M12 3v12M12 15l-4-4M12 15l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
    </svg>
  );
}

function IconoAjustes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={svg}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.63.7 1.08 1.35 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
