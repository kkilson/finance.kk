import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Cambia la contraseña de un usuario existente. El seed usa `upsert` con
 * `update: {}`, así que volver a correrlo no la toca — para eso está esto.
 *
 *   npx tsx scripts/cambiar-password.ts tu@correo.com "nueva contraseña"
 */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: npx tsx scripts/cambiar-password.ts <email> "<contraseña>"');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Usa al menos 10 caracteres.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const usuario = await prisma.usuario.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  console.log(`Contraseña actualizada para ${usuario.email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
