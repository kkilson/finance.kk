import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { NoAutenticadoError, requireUsuarioId } from "@/lib/auth";
import { SinTasaError } from "@/lib/moneda";

export type RespuestaError = { error: string; campo?: string };

export function errorJson(error: string, status: number, campo?: string) {
  return NextResponse.json<RespuestaError>({ error, ...(campo ? { campo } : {}) }, { status });
}

/**
 * Envuelve un handler: resuelve el usuario autenticado y traduce las excepciones
 * conocidas al formato de error de la sección 5 de la spec.
 */
export function conUsuario<T extends unknown[]>(
  handler: (usuarioId: string, ...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      const usuarioId = await requireUsuarioId();
      return await handler(usuarioId, ...args);
    } catch (e) {
      return manejarError(e);
    }
  };
}

export function manejarError(e: unknown): Response {
  if (e instanceof NoAutenticadoError) return errorJson("No autenticado", 401);
  if (e instanceof SinTasaError) return errorJson(e.message, 400, "moneda");
  if (e instanceof ZodError) {
    const primero = e.issues[0];
    return errorJson(primero.message, 400, primero.path.join("."));
  }
  if (e instanceof NoEncontradoError) return errorJson(e.message, 404);
  if (e instanceof ReglaNegocioError) return errorJson(e.message, 400, e.campo);
  console.error(e);
  return errorJson("Error interno del servidor", 500);
}

export class NoEncontradoError extends Error {
  constructor(recurso = "Recurso") {
    super(`${recurso} no encontrado`);
    this.name = "NoEncontradoError";
  }
}

export class ReglaNegocioError extends Error {
  campo?: string;
  constructor(mensaje: string, campo?: string) {
    super(mensaje);
    this.name = "ReglaNegocioError";
    this.campo = campo;
  }
}

export async function leerBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ReglaNegocioError("El cuerpo de la petición no es JSON válido");
  }
  return schema.parse(json);
}

function esDecimal(v: object): boolean {
  // Decimal.js expone toJSON, así que JSON.stringify por sí solo lo dejaría como string.
  return (
    typeof (v as { toFixed?: unknown }).toFixed === "function" &&
    typeof (v as { toNumber?: unknown }).toNumber === "function"
  );
}

/** Decimal de Prisma -> number, recursivo, para poder serializar respuestas. */
export function serializar<T>(valor: T): T {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    if (esDecimal(v)) return Number(v.toString());
    if (Array.isArray(v)) return v.map(walk);
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
  };
  return walk(valor) as T;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(serializar(data), { status });
}
