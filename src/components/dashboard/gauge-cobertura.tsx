import type { EstadoCobertura } from "@/lib/calculos/dias-cobertura";

const LEYENDA: Record<EstadoCobertura, (d: number, h: number | null) => string> = {
  verde: (d) =>
    `Con tu balance disponible y tus pagos pendientes, cubres ${d} días más sin recibir nuevos ingresos. Tu próximo ingreso fijo llega antes de que esto se agote.`,
  amarillo: (d, h) =>
    `Cubres ${d} días y tu próximo ingreso llega en ${h}. Llegas, pero sin margen: cuidado con los gastos nuevos esta semana.`,
  rojo: (d, h) =>
    h === null
      ? "Tu balance disponible ya está en cero o en negativo después de los pagos pendientes."
      : `Solo cubres ${d} días y tu próximo ingreso llega en ${h}. Hay que ajustar algo antes de esa fecha.`,
  sin_datos: () =>
    "Todavía no hay suficientes gastos registrados para estimar cuánto gastas por día.",
};

/** Gauge circular del prototipo: arco completo con dashoffset sobre 314. */
export function GaugeCobertura({
  dias,
  diasHastaIngreso,
  estado,
}: {
  dias: number;
  diasHastaIngreso: number | null;
  estado: EstadoCobertura;
}) {
  const CIRC = 314; // 2πr con r=50
  const horizonte = Math.max(diasHastaIngreso ?? 30, 1);
  const pct = estado === "sin_datos" ? 0 : Math.min(Math.max(dias / horizonte, 0), 1);
  const color = estado === "rojo" ? "#E88F86" : estado === "amarillo" ? "#E8C066" : "#C9962C";
  // El número grande y el texto tienen que decir lo mismo.
  const diasRedondeados = Math.round(dias);

  return (
    <div className="relative z-1 flex items-center gap-[18px]">
      <svg viewBox="0 0 120 120" className="h-[110px] w-[110px] shrink-0">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontFamily="var(--font-outfit)"
          fontWeight="800"
          fontSize="26"
          fill="#fff"
        >
          {estado === "sin_datos" ? "—" : diasRedondeados}
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#B9D8D4">
          días
        </text>
      </svg>
      <div>
        <div className="mb-0.5 text-[11.5px] uppercase tracking-[0.05em] text-[#B9D8D4]">
          Cobertura actual
        </div>
        <div className="font-display text-[30px] font-extrabold leading-tight">
          {estado === "sin_datos" ? "Sin datos" : `${diasRedondeados} días de cobertura`}
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-[#D8ECE9]">
          {LEYENDA[estado](diasRedondeados, diasHastaIngreso)}
        </p>
      </div>
    </div>
  );
}
