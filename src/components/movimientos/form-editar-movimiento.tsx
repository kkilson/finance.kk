"use client";

import { useState } from "react";
import { Boton, Campo, Input, Select } from "@/components/ui";
import type { CategoriaDTO, CuentaDTO, Moneda, MovimientoDTO, TipoMovimiento } from "@/types";

/**
 * Edición completa de un movimiento. Cambiar monto, cuenta o tipo recalcula los
 * saldos en el servidor (revierte el efecto viejo y aplica el nuevo), así que
 * desde acá se puede tocar todo sin dejar las cuentas descuadradas.
 */
export function FormEditarMovimiento({
  movimiento,
  cuentas,
  categorias,
  onGuardar,
  onCancelar,
}: {
  movimiento: MovimientoDTO;
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento.tipo);
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [cuentaId, setCuentaId] = useState(movimiento.cuenta.id);
  const [cuentaDestinoId, setCuentaDestinoId] = useState(movimiento.cuentaDestino?.id ?? "");
  const [categoriaId, setCategoriaId] = useState(movimiento.categoria?.id ?? "");
  const [fecha, setFecha] = useState(movimiento.fecha.slice(0, 10));
  const [nota, setNota] = useState(movimiento.nota ?? "");
  const [esFijo, setEsFijo] = useState(movimiento.esFijo);
  const [esExtraordinario, setEsExtraordinario] = useState(movimiento.esExtraordinario);
  const [guardando, setGuardando] = useState(false);

  const moneda: Moneda = cuentas.find((c) => c.id === cuentaId)?.moneda ?? movimiento.moneda;
  const delTipo = categorias.filter(
    (c) => c.tipo === (tipo === "INGRESO" ? "INGRESO" : "GASTO"),
  );
  const grupos = delTipo.filter((c) => c.grupoId === null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        tipo,
        monto: Number(monto),
        moneda,
        cuentaId,
        cuentaDestinoId: tipo === "TRANSFERENCIA" ? cuentaDestinoId : null,
        categoriaId: tipo === "TRANSFERENCIA" ? null : categoriaId || null,
        fecha: new Date(`${fecha}T12:00:00`).toISOString(),
        nota: nota || null,
        esFijo: tipo === "INGRESO" ? esFijo : false,
        esExtraordinario,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 py-3 md:grid-cols-3 md:items-end">
      <Campo etiqueta="Tipo">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
          <option value="GASTO">Gasto</option>
          <option value="INGRESO">Ingreso</option>
          <option value="TRANSFERENCIA">Transferencia</option>
        </Select>
      </Campo>
      <Campo etiqueta={`Monto (${moneda === "USD" ? "USD" : "Bs"})`}>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          required
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
            {tipo === "INGRESO"
              ? delTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono ? `${c.icono} ` : ""}
                    {c.nombre}
                  </option>
                ))
              : grupos.map((g) => (
                  <optgroup key={g.id} label={`${g.icono ?? ""} ${g.nombre}`}>
                    {delTipo
                      .filter((s) => s.grupoId === g.id)
                      .map((s) => (
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

      <Campo etiqueta="Fecha">
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>
      <Campo etiqueta="Nota">
        <Input value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>

      <div className="flex flex-wrap items-center gap-4 md:col-span-3">
        {tipo === "INGRESO" ? (
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input type="checkbox" checked={esFijo} onChange={(e) => setEsFijo(e.target.checked)} />
            Ingreso fijo
          </label>
        ) : null}
        {tipo === "GASTO" ? (
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={esExtraordinario}
              onChange={(e) => setEsExtraordinario(e.target.checked)}
            />
            Gasto extraordinario
          </label>
        ) : null}
      </div>

      <div className="flex gap-2 md:col-span-3">
        <Boton type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
