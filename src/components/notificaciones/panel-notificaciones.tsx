"use client";

import { useState } from "react";
import { Boton, CabeceraTarjeta, Input, Pill, Select, Tarjeta, Vacio } from "@/components/ui";
import { api } from "@/lib/cliente-api";
import { DESCRIPCION_REGLA } from "@/lib/notificaciones/reglas";

export interface ConfigReglaDTO {
  regla: keyof typeof DESCRIPCION_REGLA;
  activa: boolean;
  parametro: number;
  horaDesde: number;
  horaHasta: number;
}

export interface NotificacionDTO {
  id: string;
  titulo: string;
  cuerpo: string;
  enviadaEn: string;
  entregada: boolean;
  error: string | null;
}

type EstadoPermiso = "sin_soporte" | "concedido" | "denegado" | "pendiente";

/** applicationServerKey exige un ArrayBuffer, no la vista tipada. */
function base64UrlABuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function PanelNotificaciones({
  configs,
  historial,
  suscrito,
}: {
  configs: ConfigReglaDTO[];
  historial: NotificacionDTO[];
  suscrito: boolean;
}) {
  const [estado, setEstado] = useState<EstadoPermiso>(
    typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)
      ? "sin_soporte"
      : Notification.permission === "granted"
        ? suscrito
          ? "concedido"
          : "pendiente"
        : Notification.permission === "denied"
          ? "denegado"
          : "pendiente",
  );
  const [locales, setLocales] = useState(configs);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  async function activar() {
    setError(null);
    setMensaje(null);
    setTrabajando(true);
    try {
      if (!clavePublica) throw new Error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor");
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "pendiente");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlABuffer(clavePublica),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      await api.post("/api/notificaciones/dispositivos", {
        endpoint: json.endpoint,
        claveP256dh: json.keys?.p256dh,
        claveAuth: json.keys?.auth,
        etiqueta: navigator.userAgent.slice(0, 60),
      });
      setEstado("concedido");
      setMensaje("Este dispositivo va a recibir los avisos");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  async function guardar(cambio: Partial<ConfigReglaDTO> & { regla: ConfigReglaDTO["regla"] }) {
    setLocales((prev) =>
      prev.map((c) => (c.regla === cambio.regla ? { ...c, ...cambio } : c)),
    );
    try {
      await api.patch("/api/notificaciones/config", cambio);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function probar() {
    setError(null);
    setMensaje(null);
    setTrabajando(true);
    try {
      const r = await api.post<{ evaluados: number; enviados: number; sinDispositivos: boolean }>(
        "/api/notificaciones",
        {},
      );
      setMensaje(
        r.evaluados === 0
          ? "No hay nada que avisar en este momento"
          : r.sinDispositivos
            ? `${r.evaluados} aviso(s) pendientes, pero no hay dispositivo suscrito`
            : `${r.enviados} aviso(s) enviados`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <Tarjeta className="mb-4">
        <CabeceraTarjeta
          titulo="Notificaciones"
          extra={
            estado === "concedido" ? (
              <Pill tono="success">Activadas en este dispositivo</Pill>
            ) : estado === "denegado" ? (
              <Pill tono="danger">Bloqueadas en el navegador</Pill>
            ) : estado === "sin_soporte" ? (
              <Pill tono="neutral">Sin soporte</Pill>
            ) : (
              <Pill tono="gold">Sin activar</Pill>
            )
          }
        />

        {estado === "denegado" ? (
          <p className="mb-3 text-[13px] text-ink-soft">
            El navegador tiene bloqueadas las notificaciones para este sitio. Hay que permitirlas
            desde el candado de la barra de direcciones y volver a intentar.
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {estado === "pendiente" ? (
            <Boton onClick={activar} disabled={trabajando}>
              Activar en este dispositivo
            </Boton>
          ) : null}
          <Boton variante="secundario" onClick={probar} disabled={trabajando}>
            Evaluar ahora
          </Boton>
        </div>

        <div className="flex flex-col">
          {locales.map((c) => {
            const desc = DESCRIPCION_REGLA[c.regla];
            return (
              <div
                key={c.regla}
                className="flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-none"
              >
                <label className="flex flex-1 items-center gap-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={c.activa}
                    onChange={(e) => guardar({ regla: c.regla, activa: e.target.checked })}
                  />
                  {desc.nombre}
                </label>
                {desc.ayuda ? (
                  <label className="flex items-center gap-2 text-[11.5px] text-ink-soft">
                    {desc.ayuda}
                    <Input
                      type="number"
                      min="0"
                      value={c.parametro}
                      onChange={(e) =>
                        guardar({ regla: c.regla, parametro: Number(e.target.value) })
                      }
                      className="w-20 py-1"
                    />
                  </label>
                ) : null}
                <label className="flex items-center gap-1 text-[11.5px] text-ink-soft">
                  entre
                  <Select
                    value={c.horaDesde}
                    onChange={(e) => guardar({ regla: c.regla, horaDesde: Number(e.target.value) })}
                    className="py-1"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </Select>
                  y
                  <Select
                    value={c.horaHasta}
                    onChange={(e) => guardar({ regla: c.regla, horaHasta: Number(e.target.value) })}
                    className="py-1"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            );
          })}
        </div>

        {mensaje ? <p className="mt-3 text-[13px] text-success">{mensaje}</p> : null}
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
      </Tarjeta>

      <Tarjeta className="mb-4">
        <CabeceraTarjeta titulo="Últimos avisos" />
        {historial.length === 0 ? (
          <Vacio mensaje="Todavía no se ha generado ningún aviso." />
        ) : (
          <ul className="flex flex-col">
            {historial.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 border-b border-line py-2.5 last:border-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{n.titulo}</p>
                  <p className="text-[11.5px] text-ink-soft">
                    {n.cuerpo} · {new Date(n.enviadaEn).toLocaleString("es-VE")}
                  </p>
                </div>
                {n.entregada ? (
                  <Pill tono="success">Entregado</Pill>
                ) : (
                  <Pill tono="neutral" >{n.error ? "No entregado" : "Registrado"}</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}
