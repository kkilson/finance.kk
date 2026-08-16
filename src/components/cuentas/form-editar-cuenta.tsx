"use client";

import { useState } from "react";
import { Boton, Campo, Input, Select } from "@/components/ui";
import type { CuentaDTO, Moneda, TipoCuenta } from "@/types";

const TIPOS: { valor: TipoCuenta; label: string }[] = [
  { valor: "BANCO", label: "Banco" },
  { valor: "WALLET", label: "Wallet" },
  { valor: "EFECTIVO", label: "Efectivo" },
  { valor: "CRIPTO", label: "Cripto" },
];

export function FormEditarCuenta({
  cuenta,
  onGuardar,
  onCancelar,
}: {
  cuenta: CuentaDTO;
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [tipo, setTipo] = useState<TipoCuenta>(cuenta.tipo);
  const [moneda, setMoneda] = useState<Moneda>(cuenta.moneda);
  const [saldo, setSaldo] = useState(String(cuenta.saldoActual));
  const [activa, setActiva] = useState(cuenta.activa);
  const [guardando, setGuardando] = useState(false);

  const cambiaMoneda = moneda !== cuenta.moneda;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({ nombre, tipo, moneda, saldoActual: Number(saldo), activa });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-4 md:items-end"
    >
      <Campo etiqueta="Nombre">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
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
      <Campo
        etiqueta="Saldo actual"
        hint="Ajústalo si no cuadra con tu banco; no genera ningún movimiento"
      >
        <Input
          type="number"
          step="0.01"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          required
        />
      </Campo>

      {cambiaMoneda ? (
        <p className="text-[11.5px] text-danger md:col-span-4">
          Vas a cambiar la moneda de la cuenta. Los movimientos que ya tiene guardaron su monto en
          la moneda anterior, así que el saldo dejará de corresponderse con ellos: revisa el saldo
          después de guardar.
        </p>
      ) : null}

      <label className="flex items-center gap-2 pb-2 text-[13px] text-ink-soft md:col-span-4">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Cuenta activa (desmarcada queda archivada)
      </label>

      <div className="flex gap-2 md:col-span-4">
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
