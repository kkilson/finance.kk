"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Boton, CabeceraTarjeta, Campo, Input, Select, Tarjeta, Topbar } from "@/components/ui";
import { api } from "@/lib/cliente-api";
import {
  PanelNotificaciones,
  type ConfigReglaDTO,
  type NotificacionDTO,
} from "@/components/notificaciones/panel-notificaciones";
import type { Moneda, TasaCambioDTO } from "@/types";

export interface UsuarioDTO {
  nombre: string;
  email: string;
  monedaReferenciaDefault: Moneda;
  saldoMinimoSeguridad: number;
  umbralEndeudamiento: number;
}

export function AjustesCliente({
  usuario,
  tasas,
  configs,
  historial,
  suscrito,
}: {
  usuario: UsuarioDTO;
  tasas: { vigente: TasaCambioDTO | null; historial: TasaCambioDTO[] };
  configs: ConfigReglaDTO[];
  historial: NotificacionDTO[];
  suscrito: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(usuario);
  const [nuevaTasa, setNuevaTasa] = useState("");
  const [fuente, setFuente] = useState("BCV");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardarPreferencias(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      await api.patch("/api/usuario", {
        monedaReferenciaDefault: prefs.monedaReferenciaDefault,
        saldoMinimoSeguridad: Number(prefs.saldoMinimoSeguridad),
        umbralEndeudamiento: Number(prefs.umbralEndeudamiento),
      });
      setMensaje("Preferencias guardadas");
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function registrarTasa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      await api.post("/api/tasa-cambio", { valorBsPorUsd: Number(nuevaTasa), fuente });
      setNuevaTasa("");
      setMensaje("Tasa registrada");
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <Topbar titulo="Ajustes" subtitulo="Tasa de cambio y cómo se calculan tus indicadores" />

      <Tarjeta className="mb-4">
        <CabeceraTarjeta titulo="Tasa de cambio" />
        <p className="mb-4 text-[13px] text-ink-soft">
          Vigente:{" "}
          <span className="num text-ink">
            {tasas.vigente ? `${tasas.vigente.valorBsPorUsd} Bs/USD` : "sin registrar"}
          </span>
          {tasas.vigente ? (
            <span> · {new Date(tasas.vigente.fecha).toLocaleDateString("es-VE")}</span>
          ) : null}
        </p>
        <form
          onSubmit={registrarTasa}
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <Campo etiqueta="Nueva tasa (Bs por USD)">
            <Input
              type="number"
              step="0.0001"
              min="0.0001"
              value={nuevaTasa}
              onChange={(e) => setNuevaTasa(e.target.value)}
              required
            />
          </Campo>
          <Campo etiqueta="Fuente">
            <Select value={fuente} onChange={(e) => setFuente(e.target.value)}>
              <option value="BCV">BCV</option>
              <option value="paralelo">Paralelo</option>
              <option value="manual">Manual</option>
            </Select>
          </Campo>
          <Boton type="submit">Registrar</Boton>
        </form>

        {tasas.historial.length > 1 ? (
          <details className="mt-4 text-[13px] text-ink-soft">
            <summary className="cursor-pointer">Historial</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {tasas.historial.map((t) => (
                <li key={t.id} className="flex justify-between">
                  <span>{new Date(t.fecha).toLocaleDateString("es-VE")}</span>
                  <span className="num">
                    {t.valorBsPorUsd} · {t.fuente}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Tarjeta>

      <PanelNotificaciones configs={configs} historial={historial} suscrito={suscrito} />

      <Tarjeta>
        <CabeceraTarjeta titulo="Preferencias" />
        <form onSubmit={guardarPreferencias} className="grid gap-4 md:grid-cols-3 md:items-end">
          <Campo etiqueta="Moneda de referencia">
            <Select
              value={prefs.monedaReferenciaDefault}
              onChange={(e) =>
                setPrefs({ ...prefs, monedaReferenciaDefault: e.target.value as Moneda })
              }
            >
              <option value="USD">Dólares</option>
              <option value="BS">Bolívares</option>
            </Select>
          </Campo>
          <Campo
            etiqueta="Saldo mínimo de seguridad"
            hint="Se descuenta del disponible al calcular los días de cobertura"
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={prefs.saldoMinimoSeguridad}
              onChange={(e) => setPrefs({ ...prefs, saldoMinimoSeguridad: Number(e.target.value) })}
            />
          </Campo>
          <Campo etiqueta="Umbral de endeudamiento" hint="0.35 = 35% del ingreso fijo mensual">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={prefs.umbralEndeudamiento}
              onChange={(e) => setPrefs({ ...prefs, umbralEndeudamiento: Number(e.target.value) })}
            />
          </Campo>
          <div className="md:col-span-3">
            <Boton type="submit">Guardar</Boton>
          </div>
        </form>
      </Tarjeta>

      {mensaje ? <p className="text-[13px] text-success">{mensaje}</p> : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
