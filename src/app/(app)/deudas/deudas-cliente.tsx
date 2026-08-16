"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Boton, Tarjeta, TituloTarjeta, Topbar, Vacio } from "@/components/ui";
import { DeudaCard } from "@/components/deudas/deuda-card";
import { FormDeuda } from "@/components/deudas/form-deuda";
import { api } from "@/lib/cliente-api";
import { formato } from "@/lib/formato";
import type { CapacidadDTO, CategoriaDTO, CuentaDTO, DeudaDTO, Moneda } from "@/types";

const LEYENDA_CAPACIDAD: Record<CapacidadDTO["estado"], string> = {
  disponible: "Tienes margen para asumir un compromiso nuevo",
  en_limite: "Estás cerca de tu límite razonable; piénsalo dos veces",
  excedido: "Ya pasaste tu umbral: no conviene pedir más crédito",
  sin_datos: "Registra ingresos fijos para poder calcular tu margen",
};

export function DeudasCliente({
  deudas,
  capacidad,
  cuentas,
  categorias,
  deudaTotal,
  interesesEstimados,
  monedaReferencia,
}: {
  deudas: DeudaDTO[];
  capacidad: CapacidadDTO;
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  deudaTotal: number;
  interesesEstimados: number;
  monedaReferencia: Moneda;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const pctInteres = deudaTotal > 0 ? (interesesEstimados / deudaTotal) * 100 : 0;
  const tonoCapacidad =
    capacidad.estado === "excedido"
      ? "text-danger"
      : capacidad.estado === "en_limite"
        ? "text-brand"
        : "text-success";

  return (
    <div>
      <Topbar
        titulo="Deudas y préstamos"
        subtitulo="Cuánto debes, a quién, y cuánto te está costando en intereses"
      />

      <div className="mb-[18px] grid gap-4 md:grid-cols-3">
        <Tarjeta>
          <TituloTarjeta>Deuda total activa</TituloTarjeta>
          <p className="num my-0.5 text-[26px] font-bold text-danger">
            {formato(deudaTotal, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">{deudas.length} compromisos abiertos</p>
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Intereses este mes</TituloTarjeta>
          <p className="num my-0.5 text-[26px] font-bold">
            {formato(interesesEstimados, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">
            Estimado · {pctInteres.toFixed(1)}% del total adeudado
          </p>
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Capacidad de endeudamiento</TituloTarjeta>
          <p className={`num my-0.5 text-[26px] font-bold ${tonoCapacidad}`}>
            {capacidad.estado === "sin_datos"
              ? "—"
              : formato(capacidad.capacidadDisponible, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">{LEYENDA_CAPACIDAD[capacidad.estado]}</p>
        </Tarjeta>
      </div>

      {capacidad.estado !== "sin_datos" ? (
        <Tarjeta className="mb-[18px]">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13px] text-ink-soft">
              Comprometes{" "}
              <b className="num text-ink">
                {formato(capacidad.compromisosDeudaActuales, monedaReferencia)}
              </b>{" "}
              al mes de un ingreso fijo de{" "}
              <b className="num text-ink">
                {formato(capacidad.ingresoFijoMensual, monedaReferencia)}
              </b>
            </span>
            <span className="num text-[13px] font-bold">
              {(capacidad.ratioEndeudamientoActual * 100).toFixed(1)}% ·{" "}
              <span className="text-ink-soft">
                límite {(capacidad.umbralMaximoRecomendado * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="relative h-[7px] overflow-hidden rounded bg-surface-2">
            <div
              className={`h-full rounded ${
                capacidad.estado === "excedido"
                  ? "bg-danger"
                  : capacidad.estado === "en_limite"
                    ? "bg-brand"
                    : "bg-success"
              }`}
              style={{
                width: `${Math.min(100, capacidad.ratioEndeudamientoActual * 100)}%`,
              }}
            />
            <div
              className="absolute top-0 h-full w-px bg-ink-soft"
              style={{ left: `${Math.min(100, capacidad.umbralMaximoRecomendado * 100)}%` }}
              title="Tu umbral"
            />
          </div>
          {capacidad.detalle.length ? (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-soft">
              {capacidad.detalle.map((d) => (
                <li key={d.nombre}>
                  {d.nombre}:{" "}
                  <span className="num text-ink">
                    {formato(d.costoMensual, monedaReferencia)}/mes
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Tarjeta>
      ) : null}

      <div className="mb-4">
        <Boton onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cancelar" : "+ Registrar deuda o préstamo"}
        </Boton>
      </div>

      {abierto ? (
        <FormDeuda
          monedaPorDefecto={monedaReferencia}
          onCrear={async (datos) => {
            await accion(() => api.post("/api/deudas", datos));
            setAbierto(false);
          }}
        />
      ) : null}

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      {deudas.length === 0 ? (
        <Vacio mensaje="No tienes deudas activas registradas." />
      ) : (
        deudas.map((d) => (
          <DeudaCard
            key={d.id}
            deuda={d}
            cuentas={cuentas}
            categorias={categorias}
            onPagar={(datos) => accion(() => api.post(`/api/deudas/${d.id}/pagos`, datos))}
            onEditar={(datos) => accion(() => api.patch(`/api/deudas/${d.id}`, datos))}
            onCerrar={() => accion(() => api.del(`/api/deudas/${d.id}`))}
          />
        ))
      )}
    </div>
  );
}
