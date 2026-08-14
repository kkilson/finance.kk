import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const COOKIE = "rumbo_session";
const DIAS_VALIDEZ = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en el entorno");
  return new TextEncoder().encode(s);
}

export async function hashPassword(plano: string) {
  return bcrypt.hash(plano, 10);
}

export async function verificarPassword(plano: string, hash: string) {
  return bcrypt.compare(plano, hash);
}

export async function crearSesion(usuarioId: string) {
  const token = await new SignJWT({ sub: usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS_VALIDEZ}d`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_VALIDEZ * 24 * 60 * 60,
  });
}

export async function cerrarSesion() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Devuelve el id del usuario autenticado, o null. */
export async function usuarioIdActual(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Igual que usuarioIdActual pero lanza si no hay sesión. Para usar en route handlers. */
export async function requireUsuarioId(): Promise<string> {
  const id = await usuarioIdActual();
  if (!id) throw new NoAutenticadoError();
  return id;
}

export async function usuarioActual() {
  const id = await usuarioIdActual();
  if (!id) return null;
  return prisma.usuario.findUnique({ where: { id } });
}

export class NoAutenticadoError extends Error {
  constructor() {
    super("No autenticado");
    this.name = "NoAutenticadoError";
  }
}
