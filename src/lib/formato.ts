import type { Moneda } from "@/types";

/** Formato de cifras compartido por todas las pantallas. */
export function formato(monto: number, moneda: Moneda): string {
  const n = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
  return moneda === "USD" ? `$${n}` : `Bs ${n}`;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-08" -> "Agosto 2026" */
export function nombreMes(mesPeriodo: string): string {
  const [anio, mes] = mesPeriodo.split("-").map(Number);
  const nombre = MESES[mes - 1] ?? "";
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** Desplaza un periodo "2026-08" en N meses. */
export function desplazarMes(mesPeriodo: string, delta: number): string {
  const [anio, mes] = mesPeriodo.split("-").map(Number);
  const d = new Date(anio, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "16 ago" */
export function diaCorto(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}
