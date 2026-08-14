import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-gold text-teal-deep hover:brightness-105 font-bold",
  secundario: "bg-surface border border-line text-ink-soft hover:text-ink",
  peligro: "bg-danger text-white hover:brightness-110",
  fantasma: "bg-transparent text-ink-soft hover:text-ink",
};

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`rounded-3xl px-5 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[20px] border border-line bg-surface px-5 py-[18px] ${className}`}>
      {children}
    </div>
  );
}

export function TituloTarjeta({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-soft">
      {children}
    </p>
  );
}

export function CabeceraTarjeta({
  titulo,
  extra,
}: {
  titulo: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <h3 className="text-[15px] font-bold">{titulo}</h3>
      {extra}
    </div>
  );
}

/** Encabezado de página: título grande + subtítulo, como el .topbar del prototipo. */
export function Topbar({
  titulo,
  subtitulo,
  extra,
}: {
  titulo: string;
  subtitulo?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-[22px] flex items-start justify-between gap-4">
      <div>
        <h1 className="mb-[3px] text-[23px] font-bold">{titulo}</h1>
        {subtitulo ? <p className="text-[13.5px] text-ink-soft">{subtitulo}</p> : null}
      </div>
      {extra}
    </div>
  );
}

export function Campo({
  etiqueta,
  hint,
  children,
}: {
  etiqueta: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-medium text-ink-soft">{etiqueta}</span>
      {children}
      {hint ? <span className="text-[11.5px] text-ink-soft">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  "rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-teal";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${className}`} />;
}

export function Pill({
  children,
  tono = "neutral",
}: {
  children: ReactNode;
  tono?: "neutral" | "success" | "danger" | "gold";
}) {
  const tonos = {
    neutral: "bg-surface-2 text-ink-soft",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    gold: "bg-gold-soft text-gold",
  } as const;
  return (
    <span className={`rounded-[20px] px-2.5 py-[3px] text-[11px] font-semibold ${tonos[tono]}`}>
      {children}
    </span>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-soft">
      {mensaje}
    </p>
  );
}

export function Aviso({
  tono,
  titulo,
  detalle,
  icono,
}: {
  tono: "warn" | "ok";
  titulo: string;
  detalle: string;
  icono: string;
}) {
  return (
    <div
      className={`mb-2.5 flex items-start gap-[11px] rounded-xl px-3.5 py-3 ${
        tono === "warn" ? "bg-danger-soft" : "bg-success-soft"
      }`}
    >
      <span className="mt-px text-[15px]">{icono}</span>
      <div>
        <b className="block text-[13px]">{titulo}</b>
        <span className="text-[12px] text-ink-soft">{detalle}</span>
      </div>
    </div>
  );
}
