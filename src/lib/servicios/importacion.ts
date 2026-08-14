import type { Moneda, TipoMovimiento } from "@/types";

export type Fila = Record<string, string>;

/**
 * Qué columna del archivo alimenta cada campo. El Excel actual del usuario no
 * tiene nombres de columna fijos, así que el mapeo se decide en la UI y acá
 * solo se aplica (sección 9, Fase 5 de la spec).
 */
export interface Mapeo {
  fecha: string;
  monto: string;
  /** Opcionales: si no se mapean, se usan los valores por defecto. */
  tipo?: string | null;
  categoria?: string | null;
  cuenta?: string | null;
  moneda?: string | null;
  nota?: string | null;
}

export interface OpcionesImportacion {
  tipoPorDefecto: TipoMovimiento;
  monedaPorDefecto: Moneda;
  /** Un monto negativo se interpreta como gasto y positivo como ingreso. */
  signoDefineTipo: boolean;
  /** El archivo usa coma decimal (1.234,56) en vez de punto. */
  formatoLatino: boolean;
}

export interface MovimientoImportado {
  fila: number;
  fecha: Date;
  monto: number;
  tipo: TipoMovimiento;
  moneda: Moneda;
  nombreCategoria: string | null;
  nombreCuenta: string | null;
  nota: string | null;
}

export interface ErrorFila {
  fila: number;
  motivo: string;
  valor?: string;
}

/**
 * "1.234,56" y "1,234.56" son el mismo número escrito distinto; sin saber cuál
 * usa el archivo no hay forma de distinguir 1.234 (mil y pico) de 1.234 (uno
 * coma algo), por eso el formato lo elige el usuario.
 */
export function parsearMonto(bruto: string, formatoLatino: boolean): number | null {
  const limpio = bruto.replace(/[^\d.,+-]/g, "").trim();
  if (!limpio) return null;

  let normalizado: string;
  if (!formatoLatino) {
    normalizado = limpio.replace(/,/g, "");
  } else if (limpio.includes(",")) {
    // Formato latino completo: el punto agrupa miles y la coma es decimal.
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{1,2}$/.test(limpio)) {
    // Sin coma y con 1-2 dígitos tras el punto no es un separador de miles:
    // es un decimal. Pasa con los XLSX, donde el número llega ya como "-80.5".
    normalizado = limpio;
  } else {
    normalizado = limpio.replace(/\./g, "");
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Acepta ISO, dd/mm/yyyy y dd-mm-yyyy, que es lo que sueltan los bancos locales. */
export function parsearFecha(bruto: string): Date | null {
  const s = bruto.trim();
  if (!s) return null;

  const latino = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (latino) {
    const [, d, m, a] = latino;
    const anio = a.length === 2 ? 2000 + Number(a) : Number(a);
    const fecha = new Date(anio, Number(m) - 1, Number(d), 12);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

const DIACRITICOS = /[̀-ͯ]/g;

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "");
}

export function parsearTipo(bruto: string): TipoMovimiento | null {
  const s = normalizar(bruto);
  if (["gasto", "egreso", "debito", "salida", "pago", "-"].includes(s)) return "GASTO";
  if (["ingreso", "credito", "entrada", "abono", "deposito", "+"].includes(s)) return "INGRESO";
  if (["transferencia", "traspaso"].includes(s)) return "TRANSFERENCIA";
  return null;
}

export function parsearMoneda(bruto: string): Moneda | null {
  const s = normalizar(bruto);
  if (["usd", "$", "dolar", "dolares", "dólares"].includes(s)) return "USD";
  if (["bs", "bsd", "bolivar", "bolivares", "bs.", "ves"].includes(s)) return "BS";
  return null;
}

/** Aplica el mapeo a las filas crudas. Pura: no toca la base. */
export function mapearFilas(
  filas: Fila[],
  mapeo: Mapeo,
  opciones: OpcionesImportacion,
): { movimientos: MovimientoImportado[]; errores: ErrorFila[] } {
  const movimientos: MovimientoImportado[] = [];
  const errores: ErrorFila[] = [];

  filas.forEach((fila, i) => {
    // +2: la fila 1 del archivo es el encabezado y el índice arranca en 0.
    const numero = i + 2;
    const brutoFecha = fila[mapeo.fecha] ?? "";
    const brutoMonto = fila[mapeo.monto] ?? "";

    if (!brutoFecha.trim() && !brutoMonto.trim()) return; // fila vacía, no es error

    const fecha = parsearFecha(brutoFecha);
    if (!fecha) {
      errores.push({ fila: numero, motivo: "Fecha ilegible", valor: brutoFecha });
      return;
    }

    const montoCrudo = parsearMonto(brutoMonto, opciones.formatoLatino);
    if (montoCrudo === null || montoCrudo === 0) {
      errores.push({ fila: numero, motivo: "Monto ilegible o cero", valor: brutoMonto });
      return;
    }

    let tipo = opciones.tipoPorDefecto;
    if (mapeo.tipo) {
      const t = parsearTipo(fila[mapeo.tipo] ?? "");
      if (t) tipo = t;
    } else if (opciones.signoDefineTipo) {
      tipo = montoCrudo < 0 ? "GASTO" : "INGRESO";
    }

    let moneda = opciones.monedaPorDefecto;
    if (mapeo.moneda) {
      const m = parsearMoneda(fila[mapeo.moneda] ?? "");
      if (m) moneda = m;
    }

    movimientos.push({
      fila: numero,
      fecha,
      monto: Math.abs(montoCrudo),
      tipo,
      moneda,
      nombreCategoria: mapeo.categoria ? (fila[mapeo.categoria] ?? "").trim() || null : null,
      nombreCuenta: mapeo.cuenta ? (fila[mapeo.cuenta] ?? "").trim() || null : null,
      nota: mapeo.nota ? (fila[mapeo.nota] ?? "").trim() || null : null,
    });
  });

  return { movimientos, errores };
}

/** Adivina qué columna es cuál por el nombre, para precargar el mapeo en la UI. */
export function sugerirMapeo(columnas: string[]): Partial<Mapeo> {
  const buscar = (...claves: string[]) =>
    columnas.find((c) => claves.some((k) => normalizar(c).includes(k))) ?? undefined;

  return {
    fecha: buscar("fecha", "date", "dia"),
    monto: buscar("monto", "importe", "valor", "amount", "cantidad"),
    tipo: buscar("tipo", "movimiento", "operacion", "type"),
    categoria: buscar("categoria", "concepto", "rubro", "category"),
    cuenta: buscar("cuenta", "banco", "account"),
    moneda: buscar("moneda", "divisa", "currency"),
    nota: buscar("nota", "descripcion", "detalle", "referencia", "observacion"),
  };
}
