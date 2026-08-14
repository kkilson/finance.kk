import Papa from "papaparse";
import ExcelJS from "exceljs";
import { ReglaNegocioError } from "@/lib/api";
import type { Fila } from "./importacion";

/** Tope defensivo: un historial personal no llega a esto ni de lejos. */
export const MAX_FILAS = 5000;

export interface ArchivoParseado {
  columnas: string[];
  filas: Fila[];
  truncado: boolean;
}

export async function parsearArchivo(
  nombre: string,
  buffer: ArrayBuffer,
): Promise<ArchivoParseado> {
  const ext = nombre.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "txt") return parsearCsv(buffer);
  if (ext === "xlsx" || ext === "xlsm") return parsearExcel(buffer);
  throw new ReglaNegocioError(
    `No sé leer archivos .${ext ?? "?"}; exporta el historial como CSV o XLSX`,
    "archivo",
  );
}

function parsearCsv(buffer: ArrayBuffer): ArchivoParseado {
  const texto = new TextDecoder("utf-8").decode(buffer);
  const res = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    // Papa detecta solo si es coma, punto y coma o tabulador.
    delimiter: "",
    transformHeader: (h) => h.trim(),
  });

  const columnas = (res.meta.fields ?? []).filter((c) => c.length > 0);
  if (columnas.length === 0) {
    throw new ReglaNegocioError("El archivo no tiene una fila de encabezados legible", "archivo");
  }

  const filas = res.data.slice(0, MAX_FILAS).map((f) => aTexto(f, columnas));
  return { columnas, filas, truncado: res.data.length > MAX_FILAS };
}

async function parsearExcel(buffer: ArrayBuffer): Promise<ArchivoParseado> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  if (!hoja) throw new ReglaNegocioError("El archivo no tiene ninguna hoja", "archivo");

  const encabezado = hoja.getRow(1);
  const columnas: string[] = [];
  encabezado.eachCell({ includeEmpty: false }, (celda, col) => {
    columnas[col - 1] = String(celda.value ?? "").trim();
  });
  const limpias = columnas.filter((c) => c && c.length > 0);
  if (limpias.length === 0) {
    throw new ReglaNegocioError("La primera fila debe tener los nombres de las columnas", "archivo");
  }

  const filas: Fila[] = [];
  let total = 0;
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero === 1) return;
    total++;
    if (filas.length >= MAX_FILAS) return;
    const obj: Fila = {};
    columnas.forEach((nombre, i) => {
      if (!nombre) return;
      obj[nombre] = valorDeCelda(fila.getCell(i + 1).value);
    });
    filas.push(obj);
  });

  return { columnas: limpias, filas, truncado: total > MAX_FILAS };
}

/** Excel devuelve fechas como Date y fórmulas como objeto; todo llega como texto. */
function valorDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if ("text" in valor && typeof valor.text === "string") return valor.text;
    if ("result" in valor) return String(valor.result ?? "");
    if ("richText" in valor) return valor.richText.map((t) => t.text).join("");
  }
  return String(valor);
}

function aTexto(fila: Record<string, unknown>, columnas: string[]): Fila {
  const obj: Fila = {};
  for (const c of columnas) obj[c] = fila[c] === null || fila[c] === undefined ? "" : String(fila[c]);
  return obj;
}
