"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Mismos colores de serie que el prototipo.
const PALETA = ["#131E32", "#2C4066", "#5B7BA8", "#8FA8C8", "#5AC8B0", "#E5484D"];

export function ChartCategorias({
  datos,
}: {
  datos: { nombre: string; total: number }[];
}) {
  // Más de 6 porciones vuelven la dona ilegible; el resto se agrupa en "Otros".
  const top = datos.slice(0, 5);
  const resto = datos.slice(5);
  const filas = resto.length
    ? [...top, { nombre: "Otros", total: resto.reduce((a, r) => a + r.total, 0) }]
    : top;

  return (
    <Doughnut
      data={{
        labels: filas.map((f) => f.nombre),
        datasets: [
          {
            data: filas.map((f) => f.total),
            backgroundColor: filas.map((_, i) => PALETA[i % PALETA.length]),
            borderWidth: 0,
          },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 8, usePointStyle: true, font: { size: 11 } } } },
      }}
    />
  );
}

export function ChartTendencia({
  datos,
  simbolo,
}: {
  datos: { etiqueta: string; ingresos: number; gastos: number }[];
  simbolo: string;
}) {
  return (
    <Bar
      data={{
        labels: datos.map((d) => d.etiqueta),
        datasets: [
          {
            label: "Ingresos",
            data: datos.map((d) => d.ingresos),
            backgroundColor: "#2FA96B",
            borderRadius: 5,
          },
          {
            label: "Gastos",
            data: datos.map((d) => d.gastos),
            backgroundColor: "#E5484D",
            borderRadius: 5,
          },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: { color: "#EEF0F3" },
            ticks: { callback: (v) => `${simbolo}${v}` },
          },
          x: { grid: { display: false } },
        },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 8, usePointStyle: true, font: { size: 11 } } } },
      }}
    />
  );
}
