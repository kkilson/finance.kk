/**
 * Marca de Kover. Va en línea (no como <img>) para que herede el tamaño del
 * contenedor y se vea nítida en cualquier densidad de pantalla.
 * El archivo equivalente para usos externos está en public/logo-kover.svg.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Kover">
      <circle cx="60" cy="60" r="60" fill="var(--color-brand)" />
      <g fill="#ffffff">
        <rect x="26" y="26" width="10" height="68" />
        <rect x="26" y="84" width="68" height="10" />
        <rect x="46" y="64" width="12" height="20" />
        <rect x="64" y="52" width="12" height="32" />
        <rect x="82" y="40" width="12" height="44" />
      </g>
      <path
        d="M44 72 L62 54 L74 64 L94 38"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80 34 H98 V52"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
