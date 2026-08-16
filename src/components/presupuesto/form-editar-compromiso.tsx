"use client";

import { useState } from "react";
import { Boton, Campo, Input, Select } from "@/components/ui";
import type { CategoriaDTO, CompromisoDTO, Moneda } from "@/types";

export function FormEditarCompromiso({
  compromiso: c,
  categorias,
  onGuardar,
  onCancelar,
}: {
  compromiso: CompromisoDTO;
  categorias: CategoriaDTO[];
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [concepto, setConcepto] = useState(c.concepto);
  const [monto, setMonto] = useState(String(c.monto));
  const [moneda, setMoneda] = useState<Moneda>(c.moneda);
  const [fecha, setFecha] = useState(c.fechaEsperada.slice(0, 10));
  const [categoriaId, setCategoriaId] = useState(c.categoria?.id ?? "");
  const [esRecurrente, setEsRecurrente] = useState(c.esRecurrente);
  const [guardando, setGuardando] = useState(false);

  // Solo subcategorías: los grupos son para organizar, no para clasificar.
  const opciones = categorias.filter(
    (cat) => cat.tipo === (c.tipo === "PAGO" ? "GASTO" : "INGRESO") && cat.grupoId !== null,
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        concepto,
        monto: Number(monto),
        moneda,
        fechaEsperada: new Date(`${fecha}T12:00:00`).toISOString(),
        categoriaId: categoriaId || null,
        esRecurrente,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 pb-3 md:grid-cols-4 md:items-end">
      <Campo etiqueta="Concepto">
        <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Monto">
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className="flex-1"
          />
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
            <option value="USD">USD</option>
            <option value="BS">Bs</option>
          </Select>
        </div>
      </Campo>
      <Campo etiqueta="Fecha esperada" hint="Moverla a otro mes lo cambia de presupuesto">
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Categoría">
        <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Sin categoría</option>
          {opciones.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icono ? `${cat.icono} ` : ""}
              {cat.nombre}
            </option>
          ))}
        </Select>
      </Campo>

      <label className="flex items-center gap-2 pb-2 text-[13px] text-ink-soft md:col-span-2">
        <input
          type="checkbox"
          checked={esRecurrente}
          onChange={(e) => setEsRecurrente(e.target.checked)}
        />
        Se repite todos los meses
      </label>

      <div className="flex gap-2 md:col-span-2">
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
