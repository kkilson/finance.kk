"use client";

import { useState } from "react";
import { Boton, Campo, Input, Select, Tarjeta } from "@/components/ui";
import type { FrecuenciaCuota, Moneda, TipoDeuda } from "@/types";

const PLATAFORMAS = ["Cashea", "Krece", "Chollo", "Lysto"];

/**
 * Los campos aparecen según el tipo, replicando la misma condición que aplica
 * la validación Zod del backend (discriminated union por `tipo`).
 */
export function FormDeuda({
  monedaPorDefecto,
  onCrear,
}: {
  monedaPorDefecto: Moneda;
  onCrear: (datos: Record<string, unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoDeuda>("TARJETA");
  const [nombre, setNombre] = useState("");
  const [entidad, setEntidad] = useState("");
  const [montoOriginal, setMontoOriginal] = useState("");
  const [moneda, setMoneda] = useState<Moneda>(monedaPorDefecto);
  const [tasa, setTasa] = useState("");
  const [limite, setLimite] = useState("");
  const [saldoRestante, setSaldoRestante] = useState("");
  const [pagoMinimo, setPagoMinimo] = useState("");
  const [numeroCuotas, setNumeroCuotas] = useState("3");
  const [cuotasPagadas, setCuotasPagadas] = useState("0");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>("QUINCENAL");
  const [plataforma, setPlataforma] = useState("Cashea");
  const [nivel, setNivel] = useState("");
  const [pctInicial, setPctInicial] = useState("");
  const [penalidad, setPenalidad] = useState("");
  const [comercio, setComercio] = useState("");
  const [producto, setProducto] = useState("");
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const comun = {
      nombre,
      entidad,
      montoOriginal: Number(montoOriginal),
      moneda,
      // La UI pide el interés en % y el modelo lo guarda como fracción.
      tasaInteresMensual: tasa.trim() === "" ? null : Number(tasa) / 100,
      pagoMinimoMensual: num(pagoMinimo),
      saldoRestante: num(saldoRestante) ?? undefined,
    };
    const especifico =
      tipo === "TARJETA"
        ? { tipo, limite: Number(limite) }
        : tipo === "PRESTAMO_CUOTAS"
          ? {
            tipo,
            numeroCuotas: Number(numeroCuotas),
            frecuenciaCuota: frecuencia,
            cuotasPagadas: Number(cuotasPagadas) || 0,
            fechaCompra: new Date(`${fechaCompra}T12:00:00`).toISOString(),
          }
          : tipo === "BNPL"
            ? {
                tipo,
                plataformaBnpl: plataforma,
                numeroCuotas: Number(numeroCuotas),
                frecuenciaCuota: frecuencia,
                nivelUsuario: nivel || null,
                pctInicial: num(pctInicial),
                penalidadPorAtraso: num(penalidad),
                comercioAfiliado: comercio || null,
                producto: producto || null,
                fechaCompra: new Date(`${fechaCompra}T12:00:00`).toISOString(),
                cuotasPagadas: Number(cuotasPagadas) || 0,
                generarCuotas: true,
              }
            : { tipo };

    try {
      await onCrear({ ...comun, ...especifico });
      setNombre("");
      setMontoOriginal("");
      setLimite("");
      setSaldoRestante("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta className="mb-4">
      <form onSubmit={enviar} className="grid gap-4 md:grid-cols-3">
        <Campo etiqueta="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeuda)}>
            <option value="TARJETA">Tarjeta de crédito</option>
            <option value="PRESTAMO_CUOTAS">Préstamo en cuotas</option>
            <option value="PRESTAMO_INFORMAL">Préstamo personal / entre socios</option>
            <option value="BNPL">Compra a cuotas (Cashea, Krece…)</option>
          </Select>
        </Campo>
        <Campo etiqueta="Nombre">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === "BNPL" ? "Nevera Samsung" : "Tarjeta Mercantil"}
            required
          />
        </Campo>
        <Campo etiqueta="Entidad">
          <Input
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
            placeholder="Banco Mercantil"
            required
          />
        </Campo>

        <Campo
          etiqueta={tipo === "BNPL" ? "Precio de la compra" : "Monto original"}
          hint={tipo === "BNPL" ? "El total, antes de restar la inicial" : undefined}
        >
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={montoOriginal}
              onChange={(e) => setMontoOriginal(e.target.value)}
              required
              className="flex-1"
            />
            <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="USD">USD</option>
              <option value="BS">Bs</option>
            </Select>
          </div>
        </Campo>
        <Campo etiqueta="Saldo actual" hint="Déjalo vacío si aún no has pagado nada">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={saldoRestante}
            onChange={(e) => setSaldoRestante(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Interés mensual (%)">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            placeholder="3.2"
          />
        </Campo>

        {tipo === "TARJETA" ? (
          <>
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
            <Campo etiqueta="Pago mínimo mensual" hint="Si lo dejas vacío se estima con un %">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={pagoMinimo}
                onChange={(e) => setPagoMinimo(e.target.value)}
              />
            </Campo>
          </>
        ) : null}

        {tipo === "PRESTAMO_CUOTAS" || tipo === "BNPL" ? (
          <>
            <Campo etiqueta="Número de cuotas">
              <Input
                type="number"
                min="1"
                step="1"
                value={numeroCuotas}
                onChange={(e) => setNumeroCuotas(e.target.value)}
                required
              />
            </Campo>
            <Campo etiqueta="Frecuencia">
              <Select
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value as FrecuenciaCuota)}
              >
                <option value="QUINCENAL">Quincenal</option>
                <option value="MENSUAL">Mensual</option>
              </Select>
            </Campo>
            <Campo
              etiqueta={tipo === "BNPL" ? "Fecha de compra" : "Fecha de inicio"}
              hint="Desde aquí se cuentan las fechas de todas las cuotas"
            >
              <Input
                type="date"
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                required
              />
            </Campo>
            <Campo
              etiqueta="Cuotas ya pagadas"
              hint="Si registras la deuda a medio camino, no entran al presupuesto ni al saldo"
            >
              <Input
                type="number"
                min="0"
                step="1"
                value={cuotasPagadas}
                onChange={(e) => setCuotasPagadas(e.target.value)}
              />
            </Campo>
          </>
        ) : null}

        {tipo === "BNPL" ? (
          <>
            <Campo etiqueta="Plataforma">
              <Select value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
                {PLATAFORMAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Tu nivel" hint="Cashea nivel 1, 2, 3…">
              <Input value={nivel} onChange={(e) => setNivel(e.target.value)} />
            </Campo>
            <Campo etiqueta="Inicial (%)" hint="Lo que pagaste al momento de comprar">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={pctInicial}
                onChange={(e) => setPctInicial(e.target.value)}
                placeholder="40"
              />
            </Campo>
            <Campo etiqueta="Penalidad por atraso">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={penalidad}
                onChange={(e) => setPenalidad(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Comercio">
              <Input value={comercio} onChange={(e) => setComercio(e.target.value)} />
            </Campo>
            <Campo etiqueta="Producto">
              <Input value={producto} onChange={(e) => setProducto(e.target.value)} />
            </Campo>
            <p className="self-end pb-2 text-[11.5px] text-ink-soft md:col-span-2">
              Al guardar entran al presupuesto las{" "}
              {Math.max(Number(numeroCuotas || 0) - Number(cuotasPagadas || 0), 0)} cuotas que
              faltan, contadas desde la fecha de compra.
            </p>
          </>
        ) : null}

        <div className="md:col-span-3">
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Registrar deuda"}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
