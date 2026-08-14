import { execSync } from "node:child_process";

/**
 * Las migraciones necesitan una conexión directa o el "session pooler" de
 * Supabase; el pooler de transacción (6543) las deja colgadas. Si DIRECT_URL
 * no está configurada, seguimos con el build en vez de romper el deploy, pero
 * avisando fuerte: el esquema podría quedar desactualizado.
 */
const directa = process.env.DIRECT_URL;

if (!directa) {
  console.warn(
    "\n⚠  DIRECT_URL no está definida: se omiten las migraciones.\n" +
      "   Aplícalas a mano con `npx prisma migrate deploy` apuntando al\n" +
      "   session pooler (puerto 5432) antes de usar la app.\n",
  );
} else if (directa.includes(":6543")) {
  console.warn(
    "\n⚠  DIRECT_URL apunta al pooler de transacción (6543), donde\n" +
      "   `prisma migrate deploy` se cuelga. Usa el session pooler (5432).\n" +
      "   Se omiten las migraciones.\n",
  );
} else {
  execSync("prisma migrate deploy", { stdio: "inherit" });
}

execSync("next build", { stdio: "inherit" });
