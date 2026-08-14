"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/lib/cliente-api";
import type { Moneda } from "@/types";

const ENLACES = [
  { href: "/dashboard", label: "Inicio", icono: <IconoInicio /> },
  { href: "/movimientos", label: "Movimientos", icono: <IconoMovimientos /> },
  { href: "/presupuesto", label: "Presupuesto", icono: <IconoCalendario /> },
  { href: "/cuentas", label: "Cuentas", icono: <IconoCartera /> },
  { href: "/deudas", label: "Deudas", icono: <IconoDeudas /> },
  { href: "/categorias", label: "Categorías", icono: <IconoCategorias /> },
  { href: "/importar", label: "Importar", icono: <IconoImportar /> },
  { href: "/ajustes", label: "Ajustes", icono: <IconoAjustes /> },
];

// En móvil solo caben las cuatro principales; el resto vive en "Menú".
const PRINCIPALES = ENLACES.slice(0, 4);

export function NavPrincipal({ moneda }: { moneda: Moneda }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [monedaActual, setMonedaActual] = useState<Moneda>(moneda);
  const [menuAbierto, setMenuAbierto] = useState(false);

  async function cambiarMoneda(nueva: Moneda) {
    if (nueva === monedaActual) return;
    setMonedaActual(nueva);
    await api.patch("/api/usuario", { monedaReferenciaDefault: nueva });
    startTransition(() => router.refresh());
  }

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden w-[232px] shrink-0 flex-col bg-surface px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-7">
          <Marca />
          <div>
            <div className="font-display text-[17px] font-semibold">Rumbo</div>
            <div className="-mt-0.5 text-[11px] text-ink-soft">finanzas personales</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {ENLACES.map((e) => {
            const activo = pathname.startsWith(e.href);
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[13.5px] transition ${
                  activo
                    ? "bg-brand font-semibold text-white"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {e.icono}
                {e.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="mb-2 px-1 text-[11.5px] text-ink-soft">Moneda de referencia</div>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(["USD", "BS"] as Moneda[]).map((m) => (
              <button
                key={m}
                onClick={() => cambiarMoneda(m)}
                className={`flex-1 rounded-full py-1.5 text-[12.5px] font-medium transition ${
                  monedaActual === m ? "bg-surface text-ink sombra-suave" : "text-ink-soft"
                }`}
              >
                {m === "USD" ? "$ USD" : "Bs"}
              </button>
            ))}
          </div>
          <button
            onClick={salir}
            className="mt-3 w-full rounded-full px-3.5 py-2 text-left text-[13px] text-ink-soft transition hover:text-danger"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Menú desplegable de móvil */}
      {menuAbierto ? (
        <div className="fixed inset-0 z-20 lg:hidden">
          <button
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 bg-ink/20"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-surface p-5 pb-24">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-2" />
            <div className="grid grid-cols-3 gap-3">
              {ENLACES.slice(4).map((e) => (
                <Link
                  key={e.href}
                  href={e.href}
                  onClick={() => setMenuAbierto(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 py-4 text-[12px] text-ink"
                >
                  {e.icono}
                  {e.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex gap-1 rounded-full bg-surface-2 p-1">
              {(["USD", "BS"] as Moneda[]).map((m) => (
                <button
                  key={m}
                  onClick={() => cambiarMoneda(m)}
                  className={`flex-1 rounded-full py-2 text-[13px] font-medium ${
                    monedaActual === m ? "bg-surface text-ink sombra-suave" : "text-ink-soft"
                  }`}
                >
                  {m === "USD" ? "$ USD" : "Bs"}
                </button>
              ))}
            </div>
            <button
              onClick={salir}
              className="mt-3 w-full rounded-full py-2.5 text-[13px] text-ink-soft"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}

      {/* Barra inferior de móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-line bg-surface px-2 pb-2 pt-2 lg:hidden">
        {PRINCIPALES.map((e) => {
          const activo = pathname.startsWith(e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              className="flex flex-1 flex-col items-center gap-1 text-[10.5px]"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                  activo ? "bg-brand text-white" : "text-ink-soft"
                }`}
              >
                {e.icono}
              </span>
              <span className={activo ? "font-medium text-brand" : "text-ink-soft"}>{e.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuAbierto((v) => !v)}
          className="flex flex-1 flex-col items-center gap-1 text-[10.5px] text-ink-soft"
        >
          <span className="flex h-8 w-14 items-center justify-center rounded-full">
            <IconoMenu />
          </span>
          Menú
        </button>
      </nav>
    </>
  );
}

function Marca() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand to-brand-deep">
      <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
        <path
          d="M4 18L10 10L14 14L20 6"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const svg = "h-[18px] w-[18px]";

function IconoInicio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function IconoMovimientos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconoCartera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoDeudas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <path d="M12 2v20M17 5.5C17 4 14.8 3 12 3s-5 1.2-5 3 2 2.6 5 3.3 5 2 5 3.4-2.2 3.3-5 3.3-5-1-5-2.5" />
    </svg>
  );
}

function IconoCategorias() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <rect x="3" y="3" width="8" height="8" rx="2.5" />
      <rect x="13" y="3" width="8" height="8" rx="2.5" />
      <rect x="3" y="13" width="8" height="8" rx="2.5" />
      <rect x="13" y="13" width="8" height="8" rx="2.5" />
    </svg>
  );
}

function IconoImportar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <path d="M12 3v12M12 15l-4-4M12 15l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
    </svg>
  );
}

function IconoAjustes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.63.7 1.08 1.35 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconoMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={svg}>
      <circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
