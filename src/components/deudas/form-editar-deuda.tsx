"use client";

import { useState } from "react";
import { Boton, Campo, Input } from "@/components/ui";
import type { DeudaDTO } from "@/types";

/**
 * Edición de una deuda ya creada. Deliberadamente no deja tocar el tipo, el
 * número de cuotas ni la frecuencia: cambiarlos dejaría los compromisos ya
 * generados sin correspondencia con la deuda. Para eso conviene cerrarla y
 * registrarla de nuevo.
 */
export function FormEditarDeuda({
  deuda,
  onGuardar,
  onCancelar,
}: {
  deuda: DeudaDTO;
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(deuda.nombre);
  const [entidad, setEntidad] = useState(deuda.entidad);
  const [saldo, setSaldo] = useState(String(deuda.saldoRestante));
  const [limite, setLimite] = useState(deuda.limite !== null ? String(deuda.limite) : "");
  const [tasa, setTasa] = useState(
    deuda.tasaInteresMensual !== null ? String(deuda.tasaInteresMensual * 100) : "",
  );
  const [pagoMinimo, setPagoMinimo] = useState(
    deuda.pagoMinimoMensual !== null ? String(deuda.pagoMinimoMensual) : "",
  );
  const [proximoPago, setProximoPago] = useState(
    deuda.fechaProximoPago ? deuda.fechaProximoPago.slice(0, 10) : "",
  );
  const [guardando, setGuardando] = useState(false);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        nombre,
        entidad,
        saldoRestante: Number(saldo),
        limite: deuda.tipo === "TARJETA" ? Number(limite) : null,
        // La UI habla en %, el modelo guarda la fracción.
        tasaInteresMensual: tasa.trim() === "" ? null : Number(tasa) / 100,
        pagoMinimoMensual: num(pagoMinimo),
        fechaProximoPago: proximoPago
          ? new Date(`${proximoPago}T12:00:00`).toISOString()
          : null,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-3 md:items-end"
    >
      <Campo etiqueta="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Entidad">
        <Input value={entidad} onChange={(e) => setEntidad(e.target.value)} required />
      </Campo>
      <Campo etiqueta={`Saldo actual (${deuda.moneda === "USD" ? "USD" : "Bs"})`}>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          required
        />
      </Campo>

      {deuda.tipo === "TARJETA" ? (
        <Campo etiqueta="Límite">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            required
          />
        </Campo>
      ) : null}

      <Campo etiqueta="Interés mensual (%)">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={tasa}
          onChange={(e) => setTasa(e.target.value)}
          placeholder="0"
        />
      </Campo>
      <Campo etiqueta="Pago mínimo mensual">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={pagoMinimo}
          onChange={(e) => setPagoMinimo(e.target.value)}
        />
      </Campo>
      <Campo etiqueta="Próximo pago">
        <Input
          type="date"
          value={proximoPago}
          onChange={(e) => setProximoPago(e.target.value)}
        />
      </Campo>

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
