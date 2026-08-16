import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Migraciones y seed van SIEMPRE por una conexión de sesión: el pooler de
 * Supabase en modo transacción (6543) no soporta los locks que usa Prisma
 * Migrate y se queda colgado sin imprimir nada.
 *
 * Se resuelve con `process.env` y no con el helper `env()` a propósito: aquel
 * lanza si la variable falta, y este archivo también lo carga `prisma
 * generate`, que corre en cada `npm install` y no necesita base de datos. Con
 * el helper, un despliegue sin DIRECT_URL fallaba al instalar.
 */
const urlMigraciones = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: urlMigraciones,
  },
});
