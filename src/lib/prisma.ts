import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * El pooler de Supabase (puerto 6543, modo transacción) reparte cada consulta
 * entre conexiones distintas, así que los prepared statements con nombre se
 * rompen de forma intermitente. `pgbouncer=true` en la URL los desactiva.
 */
function esPooler(url: string): boolean {
  return url.includes(":6543") || url.includes("pooler.supabase.com");
}

function crearCliente() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL en el entorno");
  }

  const url = new URL(connectionString);
  if (esPooler(connectionString) && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url.toString(),
      // En serverless cada instancia abre su propio pool; uno grande agota las
      // conexiones de Supabase en cuanto hay varias lambdas vivas a la vez.
      max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
    }),
  });
}

function cliente(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = crearCliente();
  }
  return globalForPrisma.prisma;
}

/**
 * Perezoso a propósito: los módulos de cálculo importan este archivo pero sus
 * funciones puras se testean sin base de datos, así que la conexión solo debe
 * abrirse cuando alguien realmente consulta.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const c = cliente();
    const valor = Reflect.get(c, prop);
    return typeof valor === "function" ? valor.bind(c) : valor;
  },
});
