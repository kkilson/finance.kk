"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Boton,
  CabeceraTarjeta,
  Campo,
  Input,
  Pill,
  Select,
  Tarjeta,
  TituloTarjeta,
  Topbar,
  Vacio,
} from "@/components/ui";
import { CalendarioMes } from "@/components/presupuesto/calendario-mes";
import { FormEditarCompromiso } from "@/components/presupuesto/form-editar-compromiso";
import { api } from "@/lib/cliente-api";
import { desplazarMes, diaCorto, formato, nombreMes } from "@/lib/formato";
import type { CategoriaDTO, CompromisoDTO, CuentaDTO, PresupuestoDTO } from "@/types";

export function PresupuestoCliente({
  presupuesto,
  cuentas,
  categorias,
}: {
  presupuesto: PresupuestoDTO;
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const { mesPeriodo, monedaReferencia, compromisos, totales } = presupuesto;
  const pagos = compromisos.filter((c) => c.tipo === "PAGO");
  const ingresos = compromisos.filter((c) => c.tipo === "INGRESO_ESPERADO");

  function irA(mes: string) {
    startTransition(() => router.push(`/presupuesto?mes=${mes}`));
  }

  async function accion(fn: () => Promise<unknown>, mensaje?: string) {
    setError(null);
    setAviso(null);
    try {
      await fn();
      if (mensaje) setAviso(mensaje);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <Topbar
        titulo={`Presupuesto de ${nombreMes(mesPeriodo).split(" ")[0].toLowerCase()}`}
        subtitulo="Todo lo que debes pagar este mes y cuándo esperas cada ingreso"
        extra={
          <div className="flex items-center gap-3">
            <button
              onClick={() => irA(desplazarMes(mesPeriodo, -1))}
              className="h-[30px] w-[30px] rounded-lg bg-surface-2 text-sm"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <div className="rounded-[10px] bg-surface-2 px-3.5 py-2 text-[12.5px] text-ink-soft">
              {nombreMes(mesPeriodo)}
            </div>
            <button
              onClick={() => irA(desplazarMes(mesPeriodo, 1))}
              className="h-[30px] w-[30px] rounded-lg bg-surface-2 text-sm"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Tarjeta>
          <TituloTarjeta>Presupuestado este mes</TituloTarjeta>
          <p className="num my-0.5 text-[26px] font-bold">
            {formato(totales.presupuestado, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">
            {totales.totalCompromisos} compromiso{totales.totalCompromisos === 1 ? "" : "s"} activo
            {totales.totalCompromisos === 1 ? "" : "s"}
          </p>
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Pagado hasta hoy</TituloTarjeta>
          <p className="num my-0.5 text-[26px] font-bold text-success">
            {formato(totales.pagado, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">
            {totales.compromisosSaldados} de {totales.totalCompromisos} compromisos
          </p>
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Pendiente por pagar</TituloTarjeta>
          <p className="num my-0.5 text-[26px] font-bold text-danger">
            {formato(totales.pendiente, monedaReferencia)}
          </p>
          <p className="text-[12px] text-ink-soft">
            {(() => {
              const n = totales.totalCompromisos - totales.compromisosSaldados;
              return `${n} compromiso${n === 1 ? "" : "s"} restante${n === 1 ? "" : "s"}`;
            })()}
          </p>
        </Tarjeta>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Boton onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cancelar" : "+ Nuevo compromiso"}
        </Boton>
        <Boton
          variante="secundario"
          onClick={() =>
            accion(
              () =>
                api.post("/api/presupuesto/copiar-mes-anterior", {
                  mesOrigen: desplazarMes(mesPeriodo, -1),
                  mesDestino: mesPeriodo,
                }),
              "Compromisos recurrentes copiados del mes anterior",
            )
          }
        >
          Copiar recurrentes de {nombreMes(desplazarMes(mesPeriodo, -1))}
        </Boton>
      </div>

      {abierto ? (
        <FormCompromiso
          categorias={categorias}
          monedaPorDefecto={monedaReferencia}
          onCrear={async (datos) => {
            await accion(() => api.post("/api/presupuesto/compromisos", datos));
            setAbierto(false);
          }}
        />
      ) : null}

      {aviso ? <p className="mb-3 text-[13px] text-success">{aviso}</p> : null}
      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Tarjeta>
          <CabeceraTarjeta
            titulo="Calendario del mes"
            extra={
              <div className="flex gap-2.5 text-[11px] text-ink-soft">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-danger" />
                  Pago
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-success" />
                  Ingreso
                </span>
              </div>
            }
          />
          <CalendarioMes mesPeriodo={mesPeriodo} compromisos={compromisos} hoy={new Date()} />
        </Tarjeta>

        <Tarjeta>
          <CabeceraTarjeta titulo="Cuentas por pagar" />
          {pagos.length === 0 ? (
            <Vacio mensaje="Sin pagos registrados para este mes." />
          ) : (
            <ul className="flex flex-col">
              {pagos.map((c) => (
                <FilaCompromiso
                  key={c.id}
                  compromiso={c}
                  cuentas={cuentas}
                  categorias={categorias}
                  onMarcar={(cuentaId) =>
                    accion(() =>
                      api.patch(`/api/presupuesto/compromisos/${c.id}/marcar-pagado`, { cuentaId }),
                    )
                  }
                  onDesmarcar={() =>
                    accion(() =>
                      api.patch(`/api/presupuesto/compromisos/${c.id}/desmarcar-pagado`, {}),
                    )
                  }
                  onEditar={(datos) =>
                    accion(() => api.patch(`/api/presupuesto/compromisos/${c.id}`, datos))
                  }
                  onEliminar={() => accion(() => api.del(`/api/presupuesto/compromisos/${c.id}`))}
                />
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-4">
        <CabeceraTarjeta titulo="Ingresos esperados" />
        {ingresos.length === 0 ? (
          <Vacio mensaje="No has registrado ingresos esperados para este mes." />
        ) : (
          <ul className="flex flex-col">
            {ingresos.map((c) => (
              <FilaCompromiso
                key={c.id}
                compromiso={c}
                cuentas={cuentas}
                categorias={categorias}
                onMarcar={(cuentaId) =>
                  accion(() =>
                    api.patch(`/api/presupuesto/compromisos/${c.id}/marcar-pagado`, { cuentaId }),
                  )
                }
                onDesmarcar={() =>
                  accion(() =>
                    api.patch(`/api/presupuesto/compromisos/${c.id}/desmarcar-pagado`, {}),
                  )
                }
                onEditar={(datos) =>
                  accion(() => api.patch(`/api/presupuesto/compromisos/${c.id}`, datos))
                }
                onEliminar={() => accion(() => api.del(`/api/presupuesto/compromisos/${c.id}`))}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

function FilaCompromiso({
  compromiso: c,
  cuentas,
  categorias,
  onMarcar,
  onDesmarcar,
  onEditar,
  onEliminar,
}: {
  compromiso: CompromisoDTO;
  cuentas: CuentaDTO[];
  categorias: CategoriaDTO[];
  onMarcar: (cuentaId: string) => void;
  onDesmarcar: () => void;
  onEditar: (datos: Record<string, unknown>) => Promise<void>;
  onEliminar: () => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const saldado = c.estado === "PAGADO" || c.estado === "COBRADO";

  return (
    <li className="border-b border-line last:border-none">
      <div className="group flex items-center gap-3 py-2.5">
      <button
        onClick={() => (saldado ? undefined : setEligiendo((v) => !v))}
        disabled={saldado}
        title={saldado ? "Ya saldado" : "Marcar como saldado"}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[11px] ${
          saldado ? "border-success bg-success text-white" : "border-line"
        }`}
      >
        {saldado ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] ${saldado ? "text-ink-soft line-through" : ""}`}>
          {c.categoria?.icono ? `${c.categoria.icono} ` : ""}
          {c.concepto}
        </p>
        <p className="text-[11.5px] text-ink-soft">
          {diaCorto(c.fechaEsperada)}
          {c.estado === "ATRASADO" ? " · atrasado" : ""}
          {c.esRecurrente ? " · recurrente" : ""}
        </p>
      </div>

      {c.estado === "ATRASADO" ? <Pill tono="danger">Atrasado</Pill> : null}
      <span className="num shrink-0 text-[13px] font-semibold">{formato(c.monto, c.moneda)}</span>
      <div
        className={`flex shrink-0 gap-2 transition ${
          editando ? "" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {saldado ? (
          <button
            onClick={onDesmarcar}
            title="Volver a dejarlo pendiente"
            className="text-[11px] text-ink-soft transition hover:text-ink"
          >
            Desmarcar
          </button>
        ) : (
          <>
            <button
              onClick={() => setEditando((v) => !v)}
              className="text-[11px] text-ink-soft transition hover:text-ink"
            >
              {editando ? "Cerrar" : "Editar"}
            </button>
            <button
              onClick={onEliminar}
              className="text-[11px] text-ink-soft transition hover:text-danger"
            >
              Eliminar
            </button>
          </>
        )}
      </div>

      {eligiendo ? (
        <div className="flex shrink-0 items-center gap-1">
          <Select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onMarcar(e.target.value);
                setEligiendo(false);
              }
            }}
            className="py-1 text-[12px]"
          >
            <option value="">¿Desde qué cuenta?</option>
            {cuentas.map((cu) => (
              <option key={cu.id} value={cu.id}>
                {cu.nombre}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      </div>

      {editando ? (
        <FormEditarCompromiso
          compromiso={c}
          categorias={categorias}
          onCancelar={() => setEditando(false)}
          onGuardar={async (datos) => {
            await onEditar(datos);
            setEditando(false);
          }}
        />
      ) : null}
    </li>
  );
}

function FormCompromiso({
  categorias,
  monedaPorDefecto,
  onCrear,
}: {
  categorias: CategoriaDTO[];
  monedaPorDefecto: "BS" | "USD";
  onCrear: (datos: Record<string, unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<"PAGO" | "INGRESO_ESPERADO">("PAGO");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState(monedaPorDefecto);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState("");
  const [esRecurrente, setEsRecurrente] = useState(true);

  const filtradas = categorias.filter(
    (c) => c.tipo === (tipo === "PAGO" ? "GASTO" : "INGRESO") && c.grupoId !== null,
  );

  return (
    <Tarjeta className="mb-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onCrear({
            tipo,
            concepto,
            monto: Number(monto),
            moneda,
            fechaEsperada: new Date(`${fecha}T12:00:00`).toISOString(),
            categoriaId: categoriaId || null,
            esRecurrente,
          });
          setConcepto("");
          setMonto("");
        }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Campo etiqueta="Tipo">
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "PAGO" | "INGRESO_ESPERADO")}
          >
            <option value="PAGO">Pago</option>
            <option value="INGRESO_ESPERADO">Ingreso esperado</option>
          </Select>
        </Campo>
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
            <Select value={moneda} onChange={(e) => setMoneda(e.target.value as "BS" | "USD")}>
              <option value="USD">USD</option>
              <option value="BS">Bs</option>
            </Select>
          </div>
        </Campo>
        <Campo etiqueta="Fecha esperada">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Categoría">
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Sin categoría</option>
            {filtradas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icono ? `${c.icono} ` : ""}
                {c.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <label className="flex items-end gap-2 pb-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={esRecurrente}
            onChange={(e) => setEsRecurrente(e.target.checked)}
          />
          Se repite todos los meses
        </label>
        <div className="md:col-span-3">
          <Boton type="submit">Agregar al presupuesto</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
