"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Boton,
  Campo,
  Input,
  Segmentado,
  Select,
  Tarjeta,
  Tile,
  TituloTarjeta,
  Topbar,
  Vacio,
} from "@/components/ui";
import { api } from "@/lib/cliente-api";
import { formato } from "@/lib/formato";
import type { CuentaDTO, Moneda, TipoCuenta } from "@/types";

const TIPOS: { valor: TipoCuenta; label: string; icono: string; fondo: string }[] = [
  { valor: "BANCO", label: "Banco", icono: "🏦", fondo: "#E6EEF9" },
  { valor: "WALLET", label: "Wallet", icono: "🟣", fondo: "#EFEBFB" },
  { valor: "EFECTIVO", label: "Efectivo", icono: "💵", fondo: "#FDEAEA" },
  { valor: "CRIPTO", label: "Cripto", icono: "🟡", fondo: "#FBF0DA" },
];

type Filtro = "TODAS" | "BS" | "USD";

export function CuentasCliente({
  cuentas,
  monedaReferencia,
  tasa,
}: {
  cuentas: CuentaDTO[];
  monedaReferencia: Moneda;
  tasa: number | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("BANCO");
  const [moneda, setMoneda] = useState<Moneda>("BS");
  const [saldo, setSaldo] = useState("0");

  const activas = cuentas.filter((c) => c.activa);
  const archivadas = cuentas.filter((c) => !c.activa);

  /** Convierte a la moneda de referencia; sin tasa devuelve null en vez de mentir. */
  function aReferencia(monto: number, m: Moneda): number | null {
    if (m === monedaReferencia) return monto;
    if (!tasa) return null;
    return m === "BS" ? monto / tasa : monto * tasa;
  }

  const totalBs = activas.filter((c) => c.moneda === "BS").reduce((a, c) => a + c.saldoActual, 0);
  const totalUsd = activas.filter((c) => c.moneda === "USD").reduce((a, c) => a + c.saldoActual, 0);
  const convBs = aReferencia(totalBs, "BS");
  const convUsd = aReferencia(totalUsd, "USD");
  const balanceTotal = convBs !== null && convUsd !== null ? convBs + convUsd : null;

  const visibles = activas.filter((c) => filtro === "TODAS" || c.moneda === filtro);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <Topbar
        titulo="Cuentas"
        subtitulo="Todos tus saldos en un mismo lugar, en bolívares y en dólares"
      />

      <div className="mb-[18px] grid gap-4 md:grid-cols-3">
        <Tarjeta>
          <TituloTarjeta>Balance total</TituloTarjeta>
          <p className="num text-[26px] font-bold">
            {balanceTotal === null ? "—" : formato(balanceTotal, monedaReferencia)}
          </p>
          {balanceTotal === null ? (
            <p className="text-[12px] text-ink-soft">Falta la tasa de cambio</p>
          ) : null}
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>En bolívares</TituloTarjeta>
          <p className="num text-[26px] font-bold">{formato(totalBs, "BS")}</p>
          {monedaReferencia !== "BS" && convBs !== null ? (
            <p className="text-[12px] text-ink-soft">≈ {formato(convBs, monedaReferencia)}</p>
          ) : null}
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>En dólares</TituloTarjeta>
          <p className="num text-[26px] font-bold">{formato(totalUsd, "USD")}</p>
          {monedaReferencia !== "USD" && convUsd !== null ? (
            <p className="text-[12px] text-ink-soft">≈ {formato(convUsd, monedaReferencia)}</p>
          ) : null}
        </Tarjeta>
      </div>

      <div className="mb-4">
        <Segmentado
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { valor: "TODAS", label: "Todas" },
            { valor: "BS", label: "Bs Bolívares" },
            { valor: "USD", label: "$ Dólares" },
          ]}
        />
      </div>

      {abierto ? (
        <Tarjeta className="mb-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await accion(() =>
                api.post("/api/cuentas", { nombre, tipo, moneda, saldoActual: Number(saldo) || 0 }),
              );
              setNombre("");
              setSaldo("0");
              setAbierto(false);
            }}
            className="grid gap-4 md:grid-cols-4 md:items-end"
          >
            <Campo etiqueta="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Mercantil"
                required
              />
            </Campo>
            <Campo etiqueta="Tipo">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Moneda">
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                <option value="BS">Bolívares</option>
                <option value="USD">Dólares</option>
              </Select>
            </Campo>
            <Campo etiqueta="Saldo inicial">
              <Input
                type="number"
                step="0.01"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
              />
            </Campo>
            <div className="md:col-span-4">
              <Boton type="submit" disabled={pendiente}>
                Crear cuenta
              </Boton>
            </div>
          </form>
        </Tarjeta>
      ) : null}

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      {visibles.length === 0 ? (
        <Vacio
          mensaje={
            activas.length === 0
              ? "Todavía no tienes cuentas. Crea la primera para empezar a registrar movimientos."
              : "Ninguna cuenta en esta moneda."
          }
        />
      ) : (
        visibles.map((c) => {
          const meta = TIPOS.find((t) => t.valor === c.tipo)!;
          const conv = aReferencia(c.saldoActual, c.moneda);
          return (
            <div
              key={c.id}
              className="group mb-2.5 flex items-center gap-3.5 rounded-[18px] bg-surface px-4 py-3.5 sombra-suave"
            >
              <Tile color={meta.fondo}>{meta.icono}</Tile>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">{c.nombre}</div>
                <div className="text-[11.5px] text-ink-soft">
                  {meta.label} · {c.moneda === "BS" ? "Bs" : "USD"}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="num text-[15px] font-bold">{formato(c.saldoActual, c.moneda)}</div>
                <div className="text-[11px] text-ink-soft">
                  {c.moneda !== monedaReferencia && conv !== null
                    ? `≈ ${formato(conv, monedaReferencia)}`
                    : "Disponible"}
                </div>
              </div>
              <button
                onClick={() => accion(() => api.del(`/api/cuentas/${c.id}`))}
                className="shrink-0 text-[11px] text-ink-soft opacity-0 transition hover:text-danger group-hover:opacity-100"
              >
                Archivar
              </button>
            </div>
          );
        })
      )}

      <div className="mt-3.5 flex justify-center">
        <Boton onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cancelar" : "+ Añadir cuenta"}
        </Boton>
      </div>

      {archivadas.length ? (
        <details className="mt-6 text-[13px] text-ink-soft">
          <summary className="cursor-pointer">Archivadas ({archivadas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {archivadas.map((c) => (
              <li key={c.id} className="flex justify-between px-1">
                <span>{c.nombre}</span>
                <span className="num">{formato(c.saldoActual, c.moneda)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
