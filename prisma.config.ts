import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migraciones y seed van SIEMPRE por la conexión directa: el pooler de
    // Supabase (modo transacción) no soporta los locks de sesión que usa
    // Prisma Migrate. En local DIRECT_URL y DATABASE_URL son la misma.
    url: env("DIRECT_URL"),
  },
});
