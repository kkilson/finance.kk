import { format, parse } from "date-fns";

/** "2026-08" a partir de una fecha. */
export function mesPeriodoDe(fecha: Date): string {
  return format(fecha, "yyyy-MM");
}

/** Primer día del mes de un periodo "2026-08". */
export function inicioDePeriodo(mesPeriodo: string): Date {
  return parse(mesPeriodo, "yyyy-MM", new Date());
}

export const REGEX_MES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
