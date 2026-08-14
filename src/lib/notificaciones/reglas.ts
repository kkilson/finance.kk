import { differenceInCalendarDays, format, getDate, getDaysInMonth, startOfDay } from "date-fns";
import type { TipoRegla } from "@/generated/prisma/enums";
import type { EstadoCapacidad } from "@/lib/calculos/capacidad-endeudamiento";
import type { EstadoCobertura } from "@/lib/calculos/dias-cobertura";
import type { Moneda } from "@/types";

/**
 * NOTA: la sección 4.6 del PRD define las 8 reglas oficiales, pero ese
 * documento no está disponible. Estas son la lectura razonable del producto
 * y sus umbrales son configurables por regla (`NotificacionConfig.parametro`),
 * así que ajustar una no toca código.
 */
export interface HechoNotificable {
  regla: TipoRegla;
  titulo: string;
  cuerpo: string;
  /** Identifica el hecho concreto para no repetir la misma notificación. */
  claveDedup: string;
}

export interface ConfigRegla {
  regla: TipoRegla;
  activa: boolean;
  parametro: number | null;
  horaDesde: number;
  horaHasta: number;
}

export interface CompromisoSnapshot {
  id: string;
  tipo: "PAGO" | "INGRESO_ESPERADO";
  concepto: string;
  montoFormateado: string;
  fechaEsperada: Date;
  estado: "PENDIENTE" | "PAGADO" | "COBRADO" | "ATRASADO";
  esCuotaBnpl: boolean;
}

export interface TarjetaSnapshot {
  nombre: string;
  pctUso: number;
  saldoFormateado: string;
  limiteFormateado: string;
}

export interface SnapshotUsuario {
  hoy: Date;
  monedaReferencia: Moneda;
  compromisos: CompromisoSnapshot[];
  tarjetas: TarjetaSnapshot[];
  cobertura: {
    estado: EstadoCobertura;
    diasCobertura: number;
    diasHastaProximoIngresoFijo: number | null;
  } | null;
  capacidad: {
    estado: EstadoCapacidad;
    compromisosFormateado: string;
    ingresoFormateado: string;
  } | null;
  gastoDelMes: number;
  /** Referencia contra la que se mide el ritmo: presupuesto del mes, o ingresos. */
  referenciaMensual: number;
  gastoFormateado: string;
}

/** Umbrales por defecto cuando la configuración no fija uno. */
export const PARAMETRO_DEFAULT: Record<TipoRegla, number> = {
  PAGO_POR_VENCER: 3, // días
  PAGO_ATRASADO: 0,
  INGRESO_ESPERADO_HOY: 0,
  COBERTURA_EN_ROJO: 0,
  RITMO_DE_GASTO_ALTO: 115, // % del ritmo proporcional esperado
  TARJETA_CERCA_DEL_LIMITE: 80, // % del límite
  CUOTA_BNPL_POR_VENCER: 2, // días (las quincenales avisan más justo)
  CAPACIDAD_EXCEDIDA: 0,
};

export const DESCRIPCION_REGLA: Record<TipoRegla, { nombre: string; ayuda: string }> = {
  PAGO_POR_VENCER: {
    nombre: "Un pago está por vencer",
    ayuda: "Días de anticipación con los que quieres el aviso",
  },
  PAGO_ATRASADO: { nombre: "Se te pasó un pago", ayuda: "" },
  INGRESO_ESPERADO_HOY: {
    nombre: "Debería llegarte un ingreso",
    ayuda: "",
  },
  COBERTURA_EN_ROJO: {
    nombre: "No alcanzas hasta tu próximo ingreso",
    ayuda: "",
  },
  RITMO_DE_GASTO_ALTO: {
    nombre: "Vas gastando más rápido de lo normal",
    ayuda: "% del ritmo esperado a partir del cual te aviso",
  },
  TARJETA_CERCA_DEL_LIMITE: {
    nombre: "Una tarjeta se acerca a su límite",
    ayuda: "% del límite a partir del cual te aviso",
  },
  CUOTA_BNPL_POR_VENCER: {
    nombre: "Vence una cuota de Cashea/Krece",
    ayuda: "Días de anticipación",
  },
  CAPACIDAD_EXCEDIDA: {
    nombre: "Pasaste tu umbral de endeudamiento",
    ayuda: "",
  },
};

export const TODAS_LAS_REGLAS = Object.keys(PARAMETRO_DEFAULT) as TipoRegla[];

function param(config: ConfigRegla | undefined, regla: TipoRegla): number {
  return config?.parametro ?? PARAMETRO_DEFAULT[regla];
}

/** Solo molestamos dentro de la franja horaria configurada. */
export function enHorarioPermitido(config: ConfigRegla | undefined, hoy: Date): boolean {
  if (!config) return true;
  const h = hoy.getHours();
  return h >= config.horaDesde && h <= config.horaHasta;
}

/**
 * Evalúa las 8 reglas contra el estado actual. Pura: no consulta ni envía nada,
 * solo dice qué habría que notificar.
 */
export function evaluarReglas(
  snapshot: SnapshotUsuario,
  configs: ConfigRegla[],
): HechoNotificable[] {
  const porRegla = new Map(configs.map((c) => [c.regla, c]));
  const activa = (r: TipoRegla) => {
    const c = porRegla.get(r);
    // Sin configuración explícita la regla cuenta como activa.
    return (c?.activa ?? true) && enHorarioPermitido(c, snapshot.hoy);
  };
  const hoy = startOfDay(snapshot.hoy);
  const dia = format(hoy, "yyyy-MM-dd");
  const hechos: HechoNotificable[] = [];

  const pendientes = snapshot.compromisos.filter(
    (c) => c.estado === "PENDIENTE" || c.estado === "ATRASADO",
  );

  // 1 y 7 — vencimientos próximos. Las cuotas BNPL tienen su propia regla
  // porque son quincenales y merecen otra anticipación.
  for (const c of pendientes.filter((c) => c.tipo === "PAGO")) {
    const regla: TipoRegla = c.esCuotaBnpl ? "CUOTA_BNPL_POR_VENCER" : "PAGO_POR_VENCER";
    if (!activa(regla)) continue;
    const dias = differenceInCalendarDays(startOfDay(c.fechaEsperada), hoy);
    if (dias < 0 || dias > param(porRegla.get(regla), regla)) continue;
    hechos.push({
      regla,
      titulo:
        dias === 0
          ? `${c.concepto} vence hoy`
          : `${c.concepto} vence en ${dias} día${dias === 1 ? "" : "s"}`,
      cuerpo: `${c.montoFormateado} · ${format(c.fechaEsperada, "dd/MM")}`,
      claveDedup: `${regla}:${c.id}:${dias}`,
    });
  }

  // 2 — atrasados. Una sola vez al día, no en cada corrida del cron.
  if (activa("PAGO_ATRASADO")) {
    for (const c of pendientes.filter((c) => c.tipo === "PAGO" && c.estado === "ATRASADO")) {
      hechos.push({
        regla: "PAGO_ATRASADO",
        titulo: `Se te pasó ${c.concepto}`,
        cuerpo: `${c.montoFormateado} · vencía el ${format(c.fechaEsperada, "dd/MM")}`,
        claveDedup: `PAGO_ATRASADO:${c.id}:${dia}`,
      });
    }
  }

  // 3 — ingreso esperado que ya debería haber llegado.
  if (activa("INGRESO_ESPERADO_HOY")) {
    for (const c of pendientes.filter((c) => c.tipo === "INGRESO_ESPERADO")) {
      const dias = differenceInCalendarDays(startOfDay(c.fechaEsperada), hoy);
      if (dias > 0) continue;
      hechos.push({
        regla: "INGRESO_ESPERADO_HOY",
        titulo:
          dias === 0
            ? `Hoy debería llegarte ${c.concepto}`
            : `${c.concepto} no ha llegado`,
        cuerpo: `${c.montoFormateado} · esperado el ${format(c.fechaEsperada, "dd/MM")}`,
        claveDedup: `INGRESO_ESPERADO_HOY:${c.id}:${dia}`,
      });
    }
  }

  // 4 — la señal central del producto: no llegas al próximo ingreso.
  if (activa("COBERTURA_EN_ROJO") && snapshot.cobertura) {
    const { estado, diasCobertura, diasHastaProximoIngresoFijo } = snapshot.cobertura;
    if (estado === "rojo") {
      hechos.push({
        regla: "COBERTURA_EN_ROJO",
        titulo: "No alcanzas hasta tu próximo ingreso",
        cuerpo:
          diasHastaProximoIngresoFijo === null
            ? `Tu balance disponible cubre ${Math.round(diasCobertura)} días`
            : `Cubres ${Math.round(diasCobertura)} días y faltan ${diasHastaProximoIngresoFijo} para tu ingreso`,
        claveDedup: `COBERTURA_EN_ROJO:${dia}`,
      });
    }
  }

  // 5 — ritmo de gasto contra lo proporcional al día del mes.
  if (activa("RITMO_DE_GASTO_ALTO") && snapshot.referenciaMensual > 0) {
    const proporcion = getDate(hoy) / getDaysInMonth(hoy);
    const esperado = snapshot.referenciaMensual * proporcion;
    const umbral = param(porRegla.get("RITMO_DE_GASTO_ALTO"), "RITMO_DE_GASTO_ALTO") / 100;
    if (esperado > 0 && snapshot.gastoDelMes > esperado * umbral) {
      const pct = Math.round((snapshot.gastoDelMes / esperado) * 100);
      hechos.push({
        regla: "RITMO_DE_GASTO_ALTO",
        titulo: "Vas gastando más rápido de lo normal",
        cuerpo: `Llevas ${snapshot.gastoFormateado} este mes, ${pct}% de lo esperado a estas alturas`,
        claveDedup: `RITMO_DE_GASTO_ALTO:${format(hoy, "yyyy-MM")}:${Math.floor(pct / 10)}`,
      });
    }
  }

  // 6 — tarjetas cerca del límite.
  if (activa("TARJETA_CERCA_DEL_LIMITE")) {
    const umbral = param(
      porRegla.get("TARJETA_CERCA_DEL_LIMITE"),
      "TARJETA_CERCA_DEL_LIMITE",
    );
    for (const t of snapshot.tarjetas.filter((t) => t.pctUso >= umbral)) {
      const tramo = Math.floor(t.pctUso / 5) * 5;
      hechos.push({
        regla: "TARJETA_CERCA_DEL_LIMITE",
        titulo: `${t.nombre} al ${Math.round(t.pctUso)}% del límite`,
        cuerpo: `${t.saldoFormateado} de ${t.limiteFormateado}`,
        // Por tramos de 5%: vuelve a avisar solo si empeora de verdad.
        claveDedup: `TARJETA_CERCA_DEL_LIMITE:${t.nombre}:${tramo}`,
      });
    }
  }

  // 8 — umbral de endeudamiento pasado.
  if (activa("CAPACIDAD_EXCEDIDA") && snapshot.capacidad?.estado === "excedido") {
    hechos.push({
      regla: "CAPACIDAD_EXCEDIDA",
      titulo: "Pasaste tu umbral de endeudamiento",
      cuerpo: `Comprometes ${snapshot.capacidad.compromisosFormateado} al mes de un ingreso fijo de ${snapshot.capacidad.ingresoFormateado}`,
      claveDedup: `CAPACIDAD_EXCEDIDA:${format(hoy, "yyyy-MM")}`,
    });
  }

  return hechos;
}
