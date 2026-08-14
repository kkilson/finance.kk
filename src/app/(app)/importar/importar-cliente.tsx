"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, CabeceraTarjeta, Campo, Pill, Select, Tarjeta, Topbar, Vacio } from "@/components/ui";
import { api, ApiError } from "@/lib/cliente-api";
import { formato } from "@/lib/formato";
import type { Mapeo } from "@/lib/servicios/importacion";
import type { CuentaDTO, Moneda, TipoMovimiento } from "@/types";

interface Analisis {
  columnas: string[];
  filas: Record<string, string>[];
  truncado: boolean;
  totalFilas: number;
  sugerencia: Partial<Mapeo>;
}

interface Resultado {
  importados: number;
  omitidosPorDuplicado: number;
  errores: { fila: number; motivo: string; valor?: string }[];
  cuentasAfectadas: { nombre: string; saldoFinal: number }[];
}

const CAMPOS: { campo: keyof Mapeo; etiqueta: string; obligatorio?: boolean }[] = [
  { campo: "fecha", etiqueta: "Fecha", obligatorio: true },
  { campo: "monto", etiqueta: "Monto", obligatorio: true },
  { campo: "tipo", etiqueta: "Tipo (ingreso/gasto)" },
  { campo: "categoria", etiqueta: "Categoría" },
  { campo: "cuenta", etiqueta: "Cuenta" },
  { campo: "moneda", etiqueta: "Moneda" },
  { campo: "nota", etiqueta: "Nota / descripción" },
];

export function ImportarCliente({
  cuentas,
  monedaPorDefecto,
}: {
  cuentas: CuentaDTO[];
  monedaPorDefecto: Moneda;
}) {
  const router = useRouter();
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Partial<Mapeo>>({});
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [moneda, setMoneda] = useState<Moneda>(monedaPorDefecto);
  const [tipoPorDefecto, setTipoPorDefecto] = useState<TipoMovimiento>("GASTO");
  const [signoDefineTipo, setSignoDefineTipo] = useState(true);
  const [formatoLatino, setFormatoLatino] = useState(true);
  const [omitirDuplicados, setOmitirDuplicados] = useState(true);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function analizar(archivo: File) {
    setError(null);
    setResultado(null);
    setTrabajando(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch("/api/movimientos/importar/analizar", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new ApiError(body?.error ?? "No se pudo leer el archivo");
      setAnalisis(body);
      setMapeo(body.sugerencia);
    } catch (e) {
      setError((e as Error).message);
      setAnalisis(null);
    } finally {
      setTrabajando(false);
    }
  }

  async function importar() {
    if (!analisis) return;
    setError(null);
    setTrabajando(true);
    try {
      const r = await api.post<Resultado>("/api/movimientos/importar", {
        filas: analisis.filas,
        mapeo,
        cuentaPorDefectoId: cuentaId,
        tipoPorDefecto,
        monedaPorDefecto: moneda,
        signoDefineTipo: !mapeo.tipo && signoDefineTipo,
        formatoLatino,
        omitirDuplicados,
      });
      setResultado(r);
      setAnalisis(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  if (cuentas.length === 0) {
    return (
      <div>
        <Topbar titulo="Importar historial" />
        <Vacio mensaje="Primero crea al menos una cuenta: los movimientos importados tienen que caer en alguna." />
      </div>
    );
  }

  return (
    <div>
      <Topbar
        titulo="Importar historial"
        subtitulo="Sube el Excel o CSV que usas hoy; tú decides qué columna es cuál"
      />

      <Tarjeta className="mb-4">
        <CabeceraTarjeta titulo="1. El archivo" />
        <input
          type="file"
          accept=".csv,.txt,.xlsx,.xlsm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void analizar(f);
          }}
          className="text-[13px] file:mr-3 file:rounded-[20px] file:border-0 file:bg-gold file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-teal-deep"
        />
        <p className="mt-2 text-[11.5px] text-ink-soft">
          CSV o XLSX, hasta 4 MB. La primera fila tiene que traer los nombres de las columnas.
        </p>
      </Tarjeta>

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      {analisis ? (
        <>
          <Tarjeta className="mb-4">
            <CabeceraTarjeta
              titulo="2. Qué es cada columna"
              extra={
                <Pill>
                  {analisis.totalFilas} fila{analisis.totalFilas === 1 ? "" : "s"}
                  {analisis.truncado ? " (recortado)" : ""}
                </Pill>
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              {CAMPOS.map(({ campo, etiqueta, obligatorio }) => (
                <Campo key={campo} etiqueta={`${etiqueta}${obligatorio ? " *" : ""}`}>
                  <Select
                    value={mapeo[campo] ?? ""}
                    onChange={(e) =>
                      setMapeo({ ...mapeo, [campo]: e.target.value || undefined })
                    }
                  >
                    <option value="">— no está en el archivo —</option>
                    {analisis.columnas.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Campo>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    {analisis.columnas.map((c) => (
                      <th
                        key={c}
                        className="border-b border-line px-2.5 pb-2 text-left text-[11px] uppercase tracking-[0.04em] text-ink-soft"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analisis.filas.slice(0, 5).map((f, i) => (
                    <tr key={i}>
                      {analisis.columnas.map((c) => (
                        <td key={c} className="border-b border-line px-2.5 py-2">
                          {f[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <Tarjeta className="mb-4">
            <CabeceraTarjeta titulo="3. Cómo interpretarlo" />
            <div className="grid gap-4 md:grid-cols-3">
              <Campo
                etiqueta="Cuenta por defecto"
                hint="Se usa cuando el archivo no dice la cuenta o no la reconozco"
              >
                <Select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda === "BS" ? "Bs" : "USD"})
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Moneda por defecto">
                <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                  <option value="USD">Dólares</option>
                  <option value="BS">Bolívares</option>
                </Select>
              </Campo>
              {!mapeo.tipo ? (
                <Campo etiqueta="Si no puedo deducir el tipo, es…">
                  <Select
                    value={tipoPorDefecto}
                    onChange={(e) => setTipoPorDefecto(e.target.value as TipoMovimiento)}
                  >
                    <option value="GASTO">Gasto</option>
                    <option value="INGRESO">Ingreso</option>
                  </Select>
                </Campo>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 text-[13px] text-ink-soft">
              {!mapeo.tipo ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={signoDefineTipo}
                    onChange={(e) => setSignoDefineTipo(e.target.checked)}
                  />
                  Los montos negativos son gastos y los positivos ingresos
                </label>
              ) : null}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formatoLatino}
                  onChange={(e) => setFormatoLatino(e.target.checked)}
                />
                Los números vienen como 1.234,56 (coma decimal)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={omitirDuplicados}
                  onChange={(e) => setOmitirDuplicados(e.target.checked)}
                />
                Saltar movimientos que ya existen (misma cuenta, fecha y monto)
              </label>
            </div>

            <div className="mt-4">
              <Boton onClick={importar} disabled={trabajando || !mapeo.fecha || !mapeo.monto}>
                {trabajando ? "Importando…" : `Importar ${analisis.totalFilas} filas`}
              </Boton>
            </div>
          </Tarjeta>
        </>
      ) : null}

      {resultado ? (
        <Tarjeta>
          <CabeceraTarjeta titulo="Resultado" />
          <p className="text-[13px]">
            <b>{resultado.importados}</b> movimiento{resultado.importados === 1 ? "" : "s"}{" "}
            importado{resultado.importados === 1 ? "" : "s"}
            {resultado.omitidosPorDuplicado > 0
              ? ` · ${resultado.omitidosPorDuplicado} omitido(s) por estar repetidos`
              : ""}
          </p>
          {resultado.cuentasAfectadas.length ? (
            <ul className="mt-2 text-[12px] text-ink-soft">
              {resultado.cuentasAfectadas.map((c) => (
                <li key={c.nombre}>
                  {c.nombre}: saldo ahora{" "}
                  <span className="num text-ink">
                    {formato(
                      c.saldoFinal,
                      cuentas.find((x) => x.nombre === c.nombre)?.moneda ?? moneda,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {resultado.errores.length ? (
            <details className="mt-3 text-[12px] text-ink-soft">
              <summary className="cursor-pointer">
                {resultado.errores.length} fila(s) con avisos
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {resultado.errores.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Fila {e.fila}: {e.motivo}
                    {e.valor ? ` ("${e.valor}")` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Tarjeta>
      ) : null}
    </div>
  );
}
