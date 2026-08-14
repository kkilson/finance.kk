import type { ReactNode } from "react";
import { Tarjeta, TituloTarjeta } from "@/components/ui";

export function KpiCard({
  etiqueta,
  valor,
  sufijo,
  detalle,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  detalle?: ReactNode;
  tono?: "neutro" | "verde" | "rojo";
}) {
  const color = tono === "verde" ? "text-success" : tono === "rojo" ? "text-danger" : "text-ink";
  return (
    <Tarjeta>
      <TituloTarjeta>{etiqueta}</TituloTarjeta>
      <p className={`num mb-1.5 mt-0.5 text-[26px] font-bold ${color}`}>
        {valor}
        {sufijo ? (
          <span className="text-[13px] font-medium text-ink-soft">{sufijo}</span>
        ) : null}
      </p>
      {detalle ? <div className="text-[12px] text-ink-soft">{detalle}</div> : null}
    </Tarjeta>
  );
}
