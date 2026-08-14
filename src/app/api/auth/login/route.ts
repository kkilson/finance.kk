import { prisma } from "@/lib/prisma";
import { crearSesion, verificarPassword } from "@/lib/auth";
import { errorJson, json, leerBody, manejarError } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const { email, password } = await leerBody(req, loginSchema);
    const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    if (!usuario || !(await verificarPassword(password, usuario.passwordHash))) {
      return errorJson("Email o contraseña incorrectos", 401);
    }
    await crearSesion(usuario.id);
    return json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email });
  } catch (e) {
    return manejarError(e);
  }
}
