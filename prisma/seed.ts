import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Taxonomía tomada de la vista "Categorías" del prototipo visual (docs/rumbo-finanzas-prototipo.html):
 * grupos con subcategorías para gastos, lista plana para ingresos.
 * El color es el fondo del chip en el prototipo.
 */
type Sub = [nombre: string, icono: string, recurrente?: true];

const GRUPOS_GASTO: { nombre: string; icono: string; color: string; subs: Sub[] }[] = [
  {
    nombre: "Casa",
    icono: "🏠",
    color: "#E6EEF9",
    subs: [
      ["Alquiler", "🏢", true],
      ["Condominio", "🏬", true],
      ["Internet y teléfono", "📶", true],
      ["Mantenimiento", "🔧"],
      ["Servicios básicos", "⚡", true],
      ["TV", "📺", true],
      ["Limpieza", "🧹"],
    ],
  },
  {
    nombre: "Alimentación",
    icono: "🍽️",
    color: "#FBEFE3",
    subs: [
      ["Mercado", "🛒"],
      ["Delivery", "🛵"],
      ["Comer fuera", "🍴"],
      ["Café y bebidas", "☕"],
      ["Snacks", "🍪"],
    ],
  },
  {
    nombre: "Transporte",
    icono: "🚗",
    color: "#EFEBF7",
    subs: [
      ["Gasolina", "⛽"],
      ["Estacionamiento", "🅿️"],
      ["Transporte público", "🚌"],
      ["Mantenimiento vehículo", "🚙"],
      ["Taxis", "🚕"],
      ["Seguro vehicular", "🛡️", true],
    ],
  },
  {
    nombre: "Salud",
    icono: "❤️",
    color: "#FCE9E9",
    subs: [
      ["Seguro médico", "🛡️", true],
      ["Consultas", "⚕️"],
      ["Farmacia", "💊"],
      ["Tratamientos", "🩹"],
    ],
  },
  {
    nombre: "Bienestar",
    icono: "🌿",
    color: "#E4F3E9",
    subs: [
      ["Actividad física", "🤸"],
      ["Belleza", "💆"],
      ["Artículos deportivos", "⚽"],
      ["Aseo personal", "🧴"],
      ["Peluquería", "✂️"],
    ],
  },
  {
    nombre: "Vestimenta",
    icono: "👔",
    color: "#FBEAF2",
    subs: [
      ["Ropa", "👕"],
      ["Zapatos", "👟"],
      ["Bolsos", "👜"],
      ["Accesorios", "⌚"],
      ["Lavandería", "🧺"],
    ],
  },
  {
    nombre: "Entretenimiento",
    icono: "🎭",
    color: "#FBF3D9",
    subs: [
      ["Suscripciones", "📦", true],
      ["Eventos y salidas", "🎉"],
      ["Hobbies", "🎨"],
      ["Videojuegos", "🎮"],
      ["Recreación", "🌲"],
      ["Alcohol/tabaco", "🍷"],
    ],
  },
  {
    nombre: "Viajes",
    icono: "✈️",
    color: "#E1F1F5",
    subs: [
      ["Transporte viaje", "🚐"],
      ["Alojamiento", "🛏️"],
      ["Seguro de viaje", "🛡️"],
      ["Trámites de viaje", "📋"],
    ],
  },
  {
    nombre: "Pago de deuda",
    icono: "💳",
    color: "#FCE9E9",
    subs: [["Cuotas y abonos", "💳", true]],
  },
  {
    nombre: "Préstamo otorgado",
    icono: "🏦",
    color: "#FBF0DA",
    subs: [["Dinero prestado a terceros", "🤝"]],
  },
];

const INGRESOS: { nombre: string; icono: string; color: string; recurrente?: boolean }[] = [
  { nombre: "Salario", icono: "💼", color: "#E4F3E9", recurrente: true },
  { nombre: "Freelance", icono: "💻", color: "#E6EEF9" },
  { nombre: "Inversiones", icono: "📈", color: "#EFEBF7" },
  { nombre: "Alquileres", icono: "🏢", color: "#FBEFE3" },
  { nombre: "Ventas", icono: "🏪", color: "#FBEAF2" },
  { nombre: "Otros ingresos", icono: "👛", color: "#EEF1EC" },
  { nombre: "Cobro de deuda", icono: "🐷", color: "#E4F3E9" },
  { nombre: "Préstamo recibido", icono: "📈", color: "#E6EEF9" },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const email = (process.env.SEED_EMAIL ?? "yo@kover.local").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "kover1234";
  const nombre = process.env.SEED_NOMBRE ?? "Yo";

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { email, nombre, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Usuario listo: ${usuario.email}`);

  const existentes = await prisma.categoria.findMany({
    where: { usuarioId: usuario.id },
    select: { id: true, nombre: true },
  });
  const porNombre = new Map(existentes.map((c) => [c.nombre, c.id]));
  let creadas = 0;

  for (const grupo of GRUPOS_GASTO) {
    let grupoId = porNombre.get(grupo.nombre);
    if (!grupoId) {
      const creado = await prisma.categoria.create({
        data: {
          usuarioId: usuario.id,
          nombre: grupo.nombre,
          tipo: "GASTO",
          icono: grupo.icono,
          color: grupo.color,
        },
      });
      grupoId = creado.id;
      porNombre.set(grupo.nombre, grupoId);
      creadas++;
    }
    for (const [nombreSub, icono, recurrente] of grupo.subs) {
      if (porNombre.has(nombreSub)) continue;
      await prisma.categoria.create({
        data: {
          usuarioId: usuario.id,
          nombre: nombreSub,
          tipo: "GASTO",
          grupoId,
          icono,
          color: grupo.color,
          esRecurrenteDefault: recurrente ?? false,
        },
      });
      porNombre.set(nombreSub, "creada");
      creadas++;
    }
  }

  for (const ing of INGRESOS) {
    if (porNombre.has(ing.nombre)) continue;
    await prisma.categoria.create({
      data: {
        usuarioId: usuario.id,
        nombre: ing.nombre,
        tipo: "INGRESO",
        icono: ing.icono,
        color: ing.color,
        esRecurrenteDefault: ing.recurrente ?? false,
      },
    });
    creadas++;
  }
  console.log(`Categorías creadas: ${creadas}`);

  const tasa = await prisma.tasaCambio.findFirst();
  if (!tasa && process.env.SEED_TASA) {
    await prisma.tasaCambio.create({
      data: { valorBsPorUsd: process.env.SEED_TASA, fuente: "manual" },
    });
    console.log(`Tasa inicial registrada: ${process.env.SEED_TASA} Bs/USD`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
