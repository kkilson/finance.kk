import type { CompromisoDTO } from "@/types";

const DOWS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Calendario del mes con un tag por compromiso. Las cuotas quincenales de
 * Cashea/Krece caen más seguido que los pagos mensuales; la celda admite
 * varios tags sin cambiar de diseño.
 */
export function CalendarioMes({
  mesPeriodo,
  compromisos,
  hoy,
}: {
  mesPeriodo: string;
  compromisos: CompromisoDTO[];
  hoy: Date;
}) {
  const [anio, mes] = mesPeriodo.split("-").map(Number);
  const primero = new Date(anio, mes - 1, 1);
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() === mes - 1;
  const diaHoy = esMesActual ? hoy.getDate() : -1;

  const porDia = new Map<number, CompromisoDTO[]>();
  for (const c of compromisos) {
    const d = new Date(c.fechaEsperada).getDate();
    porDia.set(d, [...(porDia.get(d) ?? []), c]);
  }

  return (
    <div className="mt-2.5 grid grid-cols-7 gap-1.5">
      {DOWS.map((d, i) => (
        <div key={i} className="pb-1 text-center text-[11px] font-semibold text-ink-soft">
          {d}
        </div>
      ))}
      {Array.from({ length: primero.getDay() }, (_, i) => (
        <div key={`v${i}`} />
      ))}
      {Array.from({ length: diasEnMes }, (_, i) => {
        const dia = i + 1;
        const esHoy = dia === diaHoy;
        return (
          <div
            key={dia}
            className={`min-h-16 rounded-[10px] p-1.5 text-[11px] ${
              esHoy ? "bg-teal text-white" : "bg-surface-2"
            }`}
          >
            <div className={`text-[11.5px] font-semibold ${esHoy ? "text-white" : "text-ink-soft"}`}>
              {dia}
            </div>
            {(porDia.get(dia) ?? []).map((c) => (
              <span
                key={c.id}
                title={`${c.concepto} · ${c.estado.toLowerCase()}`}
                className={`mt-[3px] block truncate rounded-[5px] px-[5px] py-0.5 text-[9.5px] font-semibold leading-[1.3] ${
                  esHoy
                    ? "bg-white/20 text-white"
                    : c.tipo === "PAGO"
                      ? "bg-danger-soft text-danger"
                      : "bg-success-soft text-success"
                } ${c.estado === "PAGADO" || c.estado === "COBRADO" ? "line-through opacity-60" : ""}`}
              >
                {c.concepto}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
