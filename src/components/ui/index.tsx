import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-brand text-white hover:brightness-105",
  secundario: "bg-surface text-ink-soft hover:text-ink sombra-suave",
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
      className={`rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTES[variante]} ${className}`}
    />
  );
}

/** Botón que navega. Para que un estado vacío no sea un callejón sin salida. */
export function BotonEnlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-105"
    >
      {children}
    </Link>
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
    <div className={`rounded-[22px] bg-surface px-5 py-[18px] sombra-suave ${className}`}>
      {children}
    </div>
  );
}

export function TituloTarjeta({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-[12.5px] font-medium text-ink-soft">{children}</p>;
}

export function CabeceraTarjeta({ titulo, extra }: { titulo: string; extra?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="text-[15px] font-semibold">{titulo}</h3>
      {extra}
    </div>
  );
}

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
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold">{titulo}</h1>
        {subtitulo ? <p className="mt-0.5 text-[13.5px] text-ink-soft">{subtitulo}</p> : null}
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

// Sin borde: el relleno gris ya delimita el campo.
const CONTROL =
  "rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition focus:bg-surface focus:ring-2 focus:ring-brand/40";

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
  tono?: "neutral" | "success" | "danger" | "brand" | "warn";
}) {
  const tonos = {
    neutral: "bg-surface-2 text-ink-soft",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    brand: "bg-brand-suave text-brand",
    warn: "bg-warn-soft text-warn",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${tonos[tono]}`}>
      {children}
    </span>
  );
}

/**
 * Control segmentado: pista gris y píldora blanca para la opción activa.
 * Es el patrón de "Todas / Bolívares / Dólares" y "Gastos / Ingresos".
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  tonoActivo,
}: {
  opciones: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  tonoActivo?: "danger" | "success" | "brand";
}) {
  const activo =
    tonoActivo === "danger"
      ? "bg-danger text-white"
      : tonoActivo === "success"
        ? "bg-success text-white"
        : tonoActivo === "brand"
          ? "bg-brand text-white"
          : "bg-surface text-ink sombra-suave";

  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
            valor === o.valor ? activo : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tile de icono: cuadrado redondeado con fondo pastel. */
export function Tile({
  children,
  color,
  tamano = "md",
}: {
  children: ReactNode;
  color?: string | null;
  tamano?: "sm" | "md";
}) {
  const medida = tamano === "sm" ? "h-9 w-9 text-[15px]" : "h-11 w-11 text-[17px]";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[13px] ${medida}`}
      style={{ background: color ?? "var(--color-surface-2)" }}
    >
      {children}
    </div>
  );
}

export function Vacio({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-[22px] text-ink-soft">
        ↕
      </div>
      <p className="max-w-sm text-[13.5px] text-ink-soft">{mensaje}</p>
      {accion}
    </div>
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
      className={`mb-2.5 flex items-start gap-3 rounded-2xl px-3.5 py-3 ${
        tono === "warn" ? "bg-danger-soft" : "bg-success-soft"
      }`}
    >
      <span className="mt-px text-[15px]">{icono}</span>
      <div>
        <b className="block text-[13px] font-semibold">{titulo}</b>
        <span className="text-[12px] text-ink-soft">{detalle}</span>
      </div>
    </div>
  );
}
