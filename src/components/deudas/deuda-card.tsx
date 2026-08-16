"use client";

import { useState } from "react";
import { Boton, Campo, Input, Pill, Select } from "@/components/ui";
import { FormEditarDeuda } from "@/components/deudas/form-editar-deuda";
import { diaCorto, formato } from "@/lib/formato";
import type { CategoriaDTO, CuentaDTO, DeudaDTO } from "@/types";

const ETIQUETA_TIPO: Record<DeudaDTO["tipo"], string> = {
  TARJETA: "Tarjeta",
  PRESTAMO_CUOTAS: "Préstamo en cuotas",
  PRESTAMO_INFORMAL: "Préstamo personal",
  BNPL: "Compra a cuotas",
};

export function DeudaCard({
  deuda: d,
  cuentas,
  categorias,
  onPagar,
  onEditar,
  onEliminarPago,
  onCerrar,
}: {
  deuda: DeudaDTO;
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  onPagar: (datos: Record<string, unknown>) => Promise<void>;
  onEditar: (datos: Record<string, unknown>) => Promise<void>;
  onEliminarPago: (pagoId: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const pagos = d.pagos ?? [];
  const [pagando, setPagando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [verPagos, setVerPagos] = useState(false);
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = useState(
    categorias.find((c) => c.nombre === "Cuotas y abonos")?.id ?? "",
  );

  // Para tarjetas el progreso es cuánto del límite está usado (mientras más, peor).
  // Para el resto, cuánto del monto original ya pagaste.
  const esTarjeta = d.tipo === "TARJETA" && d.limite !== null && d.limite > 0;
  const pctUso = esTarjeta ? Math.min(100, (d.saldoRestante / d.limite!) * 100) : 0;
  const pctPagado =
    d.montoOriginal > 0
      ? Math.min(100, ((d.montoOriginal - d.saldoRestante) / d.montoOriginal) * 100)
      : 0;

  return (
    <div className="mb-3 rounded-[22px] bg-surface px-[18px] py-4 sombra-suave">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[14.5px] font-bold">{d.nombre}</div>
          <div className="text-[12px] text-ink-soft">
            {d.entidad} · {ETIQUETA_TIPO[d.tipo]}
            {/* La plataforma suele ser la misma entidad; no la repetimos. */}
            {d.plataformaBnpl && d.plataformaBnpl !== d.entidad ? ` · ${d.plataformaBnpl}` : ""}
            {d.nivelUsuario ? ` · nivel ${d.nivelUsuario}` : ""}
            {d.producto ? ` · ${d.producto}` : ""}
          </div>
        </div>
        {esTarjeta ? (
          <Pill tono={pctUso >= 80 ? "danger" : pctUso >= 50 ? "brand" : "neutral"}>
            {Math.round(pctUso)}% del límite
          </Pill>
        ) : d.saldoRestante === 0 ? (
          <Pill tono="success">Saldada</Pill>
        ) : (
          <Pill tono="neutral">{Math.round(pctPagado)}% pagado</Pill>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Stat
          label={esTarjeta ? "Límite" : "Monto original"}
          valor={formato(esTarjeta ? d.limite! : d.montoOriginal, d.moneda)}
        />
        <Stat
          label={esTarjeta ? "Usado" : "Saldo restante"}
          valor={formato(d.saldoRestante, d.moneda)}
        />
        <Stat
          label="Tasa de interés"
          valor={d.tasaInteresMensual ? `${(d.tasaInteresMensual * 100).toFixed(1)}% mens.` : "0%"}
        />
        <Stat
          label={d.tipo === "TARJETA" ? "Próximo pago" : "Próxima cuota"}
          valor={
            d.fechaProximoPago
              ? `${diaCorto(d.fechaProximoPago)}${
                  d.numeroCuotas ? ` · ${d.numeroCuotas} cuotas` : ""
                }`
              : "Sin fecha fija"
          }
        />
      </div>

      <div className="mt-3 h-[7px] overflow-hidden rounded bg-surface-2">
        <div
          className={`h-full rounded ${
            esTarjeta ? (pctUso >= 80 ? "bg-danger" : "bg-brand") : "bg-brand-deep"
          }`}
          style={{ width: `${esTarjeta ? pctUso : Math.max(pctPagado, 2)}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Boton
          variante="secundario"
          onClick={() => {
            setPagando((v) => !v);
            setEditando(false);
          }}
        >
          {pagando ? "Cancelar" : "Registrar pago"}
        </Boton>
        <Boton
          variante="secundario"
          onClick={() => {
            setEditando((v) => !v);
            setPagando(false);
          }}
        >
          {editando ? "Cancelar" : "Editar"}
        </Boton>
        {pagos.length ? (
          <Boton variante="secundario" onClick={() => setVerPagos((v) => !v)}>
            {verPagos ? "Ocultar pagos" : `Pagos (${pagos.length})`}
          </Boton>
        ) : null}
        <Boton variante="fantasma" onClick={onCerrar}>
          Cerrar deuda
        </Boton>
      </div>

      {verPagos ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2 text-[11.5px] text-ink-soft">
            Deshacer un pago devuelve el dinero a la cuenta, sube el saldo de la deuda y, si venía
            del presupuesto, marca esa cuota como pendiente otra vez.
          </p>
          <ul className="flex flex-col">
            {pagos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-none"
              >
                <span className="text-[12.5px] text-ink-soft">
                  {new Date(p.fecha).toLocaleDateString("es-VE")}
                </span>
                <span className="num flex-1 text-right text-[13px] font-medium">
                  {formato(p.monto, d.moneda)}
                </span>
                <button
                  onClick={() => onEliminarPago(p.id)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] text-ink-soft transition hover:bg-danger-soft hover:text-danger"
                >
                  Deshacer
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {editando ? (
        <FormEditarDeuda
          deuda={d}
          onCancelar={() => setEditando(false)}
          onGuardar={async (datos) => {
            await onEditar(datos);
            setEditando(false);
          }}
        />
      ) : null}

      {pagando ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onPagar({
              cuentaId,
              monto: Number(monto),
              categoriaId: categoriaId || null,
            });
            setMonto("");
            setPagando(false);
          }}
          className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-4 md:items-end"
        >
          <Campo etiqueta={`Monto (${d.moneda})`}>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </Campo>
          <Campo etiqueta="Desde">
            <Select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Categoría">
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categorias
                .filter((c) => c.tipo === "GASTO")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono ? `${c.icono} ` : ""}
                    {c.nombre}
                  </option>
                ))}
            </Select>
          </Campo>
          <Boton type="submit">Guardar pago</Boton>
        </form>
      ) : null}
    </div>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10.5px] uppercase tracking-[0.03em] text-ink-soft">{label}</div>
      <div className="num text-[14px] font-bold">{valor}</div>
    </div>
  );
}
