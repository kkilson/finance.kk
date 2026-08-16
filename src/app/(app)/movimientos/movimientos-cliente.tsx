"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Boton,
  BotonEnlace,
  Campo,
  Input,
  Segmentado,
  Select,
  Tarjeta,
  Topbar,
  Vacio,
} from "@/components/ui";
import { FormEditarMovimiento } from "@/components/movimientos/form-editar-movimiento";
import { api } from "@/lib/cliente-api";
import { formato } from "@/lib/formato";
import type { CategoriaDTO, CuentaDTO, Moneda, MovimientoDTO, TipoMovimiento } from "@/types";

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MovimientosCliente({
  cuentas,
  categorias,
  movimientos,
}: {
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  movimientos: MovimientoDTO[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [detalles, setDetalles] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Los 3 campos del "registro en 3 toques" (sección 6 de la spec)
  const [tipo, setTipo] = useState<TipoMovimiento>("GASTO");
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = useState("");
  // Colapsados en "más detalles"
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [esFijo, setEsFijo] = useState(false);
  const [esExtraordinario, setEsExtraordinario] = useState(false);
  const [cuentaDestinoId, setCuentaDestinoId] = useState("");

  const cuentaSeleccionada = cuentas.find((c) => c.id === cuentaId);
  const monedaMovimiento: Moneda = cuentaSeleccionada?.moneda ?? "BS";

  /** Las de gasto van agrupadas; las de ingreso son planas. */
  const opcionesCategoria = useMemo(() => {
    const tipoCat = tipo === "INGRESO" ? "INGRESO" : "GASTO";
    const delTipo = categorias.filter((c) => c.tipo === tipoCat);
    if (tipoCat === "INGRESO") return { planas: delTipo, grupos: [] as const };
    const grupos = delTipo.filter((c) => c.grupoId === null);
    return {
      planas: delTipo.filter((c) => c.grupoId === null && grupos.length === 0),
      grupos: grupos.map((g) => ({ grupo: g, subs: delTipo.filter((s) => s.grupoId === g.id) })),
    };
  }, [categorias, tipo]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await api.post("/api/movimientos", {
        cuentaId,
        categoriaId: tipo === "TRANSFERENCIA" ? null : categoriaId || null,
        tipo,
        monto: Number(monto),
        moneda: monedaMovimiento,
        fecha: new Date(`${fecha}T12:00:00`).toISOString(),
        nota: nota || null,
        esFijo: tipo === "INGRESO" ? esFijo : false,
        esExtraordinario,
        cuentaDestinoId: tipo === "TRANSFERENCIA" ? cuentaDestinoId : null,
      });
      setMonto("");
      setNota("");
      setEsExtraordinario(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    setError(null);
    try {
      await api.del(`/api/movimientos/${id}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function editar(id: string, datos: Record<string, unknown>) {
    setError(null);
    try {
      await api.patch(`/api/movimientos/${id}`, datos);
      setEditandoId(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (cuentas.length === 0) {
    return (
      <div>
        <Topbar titulo="Movimientos" />
        <Vacio
          mensaje="Para registrar un movimiento hace falta al menos una cuenta activa: es de donde sale o entra el dinero."
          accion={<BotonEnlace href="/cuentas">Crear mi primera cuenta</BotonEnlace>}
        />
      </div>
    );
  }

  return (
    <div>
      <Topbar
        titulo="Movimientos"
        subtitulo="Registra un gasto o un ingreso en tres toques: monto, cuenta y categoría"
      />

      <Tarjeta className="mb-4">
        <div className="mb-4">
          <Segmentado
            valor={tipo}
            onChange={(t) => {
              setTipo(t);
              setCategoriaId("");
            }}
            tonoActivo={tipo === "GASTO" ? "danger" : tipo === "INGRESO" ? "success" : "brand"}
            opciones={[
              { valor: "GASTO", label: "Gasto" },
              { valor: "INGRESO", label: "Ingreso" },
              { valor: "TRANSFERENCIA", label: "Transferencia" },
            ]}
          />
        </div>

        <form onSubmit={registrar} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Campo etiqueta={`Monto (${monedaMovimiento === "USD" ? "USD" : "Bs"})`}>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                autoFocus
              />
            </Campo>
            <Campo etiqueta={tipo === "TRANSFERENCIA" ? "Desde" : "Cuenta"}>
              <Select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda === "BS" ? "Bs" : "USD"})
                  </option>
                ))}
              </Select>
            </Campo>
            {tipo === "TRANSFERENCIA" ? (
              <Campo etiqueta="Hacia">
                <Select
                  value={cuentaDestinoId}
                  onChange={(e) => setCuentaDestinoId(e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  {cuentas
                    .filter((c) => c.id !== cuentaId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.moneda === "BS" ? "Bs" : "USD"})
                      </option>
                    ))}
                </Select>
              </Campo>
            ) : (
              <Campo etiqueta="Categoría">
                <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {opcionesCategoria.planas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icono ? `${c.icono} ` : ""}
                      {c.nombre}
                    </option>
                  ))}
                  {opcionesCategoria.grupos.map(({ grupo, subs }) => (
                    <optgroup key={grupo.id} label={`${grupo.icono ?? ""} ${grupo.nombre}`}>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icono ? `${s.icono} ` : ""}
                          {s.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Campo>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDetalles((v) => !v)}
            className="self-start text-[12px] text-ink-soft hover:text-ink"
          >
            {detalles ? "− Menos detalles" : "+ Más detalles"}
          </button>

          {detalles ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Campo etiqueta="Fecha">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Campo>
              <Campo etiqueta="Nota">
                <Input value={nota} onChange={(e) => setNota(e.target.value)} />
              </Campo>
              {tipo === "INGRESO" ? (
                <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={esFijo}
                    onChange={(e) => setEsFijo(e.target.checked)}
                  />
                  Es un ingreso fijo (sueldo, pago recurrente)
                </label>
              ) : null}
              {tipo === "GASTO" ? (
                <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={esExtraordinario}
                    onChange={(e) => setEsExtraordinario(e.target.checked)}
                  />
                  Gasto extraordinario (no cuenta para el promedio diario)
                </label>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div>
            <Boton type="submit" disabled={guardando || !cuentaId}>
              {guardando ? "Guardando…" : "Registrar"}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {movimientos.length === 0 ? (
        <Vacio mensaje="Sin movimientos registrados todavía." />
      ) : (
        <div className="rounded-[22px] bg-surface px-5 py-2 sombra-suave">
          {movimientos.map((m) => (
            <div key={m.id} className="border-b border-line last:border-none">
              <div className="group flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">
                    {m.categoria?.icono ? `${m.categoria.icono} ` : ""}
                    {m.categoria?.nombre ??
                      (m.tipo === "TRANSFERENCIA"
                        ? `${m.cuenta.nombre} → ${m.cuentaDestino?.nombre ?? "?"}`
                        : "Sin categoría")}
                    {m.nota ? <span className="text-ink-soft"> · {m.nota}</span> : null}
                  </p>
                  <p className="text-[11.5px] text-ink-soft">
                    {new Date(m.fecha).toLocaleDateString("es-VE")} · {m.cuenta.nombre}
                    {m.esExtraordinario ? " · extraordinario" : ""}
                    {m.esFijo ? " · fijo" : ""}
                  </p>
                </div>
                <span
                  className={`num shrink-0 text-[13.5px] font-semibold ${
                    m.tipo === "INGRESO"
                      ? "text-success"
                      : m.tipo === "GASTO"
                        ? "text-danger"
                        : "text-ink-soft"
                  }`}
                >
                  {m.tipo === "INGRESO" ? "+" : m.tipo === "GASTO" ? "−" : ""}
                  {formato(m.monto, m.moneda)}
                </span>
                <div
                  className={`flex shrink-0 gap-2 transition ${
                    editandoId === m.id ? "" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <button
                    onClick={() => setEditandoId(editandoId === m.id ? null : m.id)}
                    className="text-[11px] text-ink-soft transition hover:text-ink"
                  >
                    {editandoId === m.id ? "Cerrar" : "Editar"}
                  </button>
                  <button
                    onClick={() => borrar(m.id)}
                    className="text-[11px] text-ink-soft transition hover:text-danger"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {editandoId === m.id ? (
                <FormEditarMovimiento
                  movimiento={m}
                  cuentas={cuentas}
                  categorias={categorias}
                  onCancelar={() => setEditandoId(null)}
                  onGuardar={(datos) => editar(m.id, datos)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
