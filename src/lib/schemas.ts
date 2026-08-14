import { z } from "zod";
import { REGEX_MES_PERIODO } from "@/lib/periodo";

export const monedaSchema = z.enum(["BS", "USD"]);
export const tipoCuentaSchema = z.enum(["BANCO", "WALLET", "EFECTIVO", "CRIPTO"]);
export const tipoCategoriaSchema = z.enum(["GASTO", "INGRESO"]);
export const tipoMovimientoSchema = z.enum(["INGRESO", "GASTO", "TRANSFERENCIA"]);

const fechaIso = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Fecha inválida" })
  .transform((s) => new Date(s));

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const cuentaCrearSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  tipo: tipoCuentaSchema,
  moneda: monedaSchema,
  saldoActual: z.number().finite().default(0),
  favorita: z.boolean().default(false),
});

export const cuentaEditarSchema = cuentaCrearSchema
  .partial()
  .extend({ activa: z.boolean().optional() });

export const categoriaCrearSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  tipo: tipoCategoriaSchema,
  grupoId: z.string().nullish(),
  icono: z.string().nullish(),
  color: z.string().nullish(),
  esRecurrenteDefault: z.boolean().default(false),
});

export const categoriaEditarSchema = categoriaCrearSchema
  .partial()
  .extend({ archivada: z.boolean().optional() });

export const movimientoCrearSchema = z
  .object({
    cuentaId: z.string().min(1, "La cuenta es obligatoria"),
    categoriaId: z.string().nullish(),
    tipo: tipoMovimientoSchema,
    monto: z.number().positive("El monto debe ser mayor a cero"),
    moneda: monedaSchema,
    fecha: fechaIso.optional(),
    nota: z.string().nullish(),
    esFijo: z.boolean().default(false),
    esRecurrente: z.boolean().default(false),
    esExtraordinario: z.boolean().default(false),
    cuentaDestinoId: z.string().nullish(),
    compromisoId: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "TRANSFERENCIA") {
      if (!v.cuentaDestinoId) {
        ctx.addIssue({
          code: "custom",
          path: ["cuentaDestinoId"],
          message: "La cuenta destino es obligatoria en una transferencia",
        });
      } else if (v.cuentaDestinoId === v.cuentaId) {
        ctx.addIssue({
          code: "custom",
          path: ["cuentaDestinoId"],
          message: "La cuenta destino debe ser distinta a la de origen",
        });
      }
    }
    if (v.esFijo && v.tipo !== "INGRESO") {
      ctx.addIssue({
        code: "custom",
        path: ["esFijo"],
        message: "esFijo solo aplica a ingresos",
      });
    }
  });

export const movimientoEditarSchema = z.object({
  categoriaId: z.string().nullish(),
  fecha: fechaIso.optional(),
  nota: z.string().nullish(),
  esFijo: z.boolean().optional(),
  esRecurrente: z.boolean().optional(),
  esExtraordinario: z.boolean().optional(),
});

export const tasaCambioCrearSchema = z.object({
  valorBsPorUsd: z.number().positive("La tasa debe ser mayor a cero"),
  fuente: z.string().trim().min(1).default("manual"),
  fecha: fechaIso.optional(),
});

export const mesPeriodoSchema = z
  .string()
  .regex(REGEX_MES_PERIODO, 'El periodo debe tener formato "2026-08"');

// ---------- Presupuesto ----------

export const compromisoCrearSchema = z.object({
  tipo: z.enum(["PAGO", "INGRESO_ESPERADO"]),
  concepto: z.string().trim().min(1, "El concepto es obligatorio"),
  categoriaId: z.string().nullish(),
  deudaId: z.string().nullish(),
  monto: z.number().positive("El monto debe ser mayor a cero"),
  moneda: monedaSchema,
  fechaEsperada: fechaIso,
  esRecurrente: z.boolean().default(false),
});

export const compromisoEditarSchema = z.object({
  concepto: z.string().trim().min(1).optional(),
  categoriaId: z.string().nullish(),
  monto: z.number().positive().optional(),
  moneda: monedaSchema.optional(),
  fechaEsperada: fechaIso.optional(),
  esRecurrente: z.boolean().optional(),
  estado: z.enum(["PENDIENTE", "PAGADO", "COBRADO", "ATRASADO"]).optional(),
});

export const marcarPagadoSchema = z.object({
  cuentaId: z.string().min(1, "La cuenta es obligatoria"),
  fecha: fechaIso.optional(),
});

export const copiarMesSchema = z.object({
  mesOrigen: mesPeriodoSchema,
  mesDestino: mesPeriodoSchema,
});

// ---------- Deudas ----------

export const frecuenciaCuotaSchema = z.enum(["MENSUAL", "QUINCENAL"]);

const deudaBase = {
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  entidad: z.string().trim().min(1, "La entidad es obligatoria"),
  montoOriginal: z.number().positive("El monto debe ser mayor a cero"),
  moneda: monedaSchema,
  tasaInteresMensual: z.number().min(0).nullish(),
  pagoMinimoMensual: z.number().min(0).nullish(),
  fechaProximoPago: fechaIso.nullish(),
  diaCierre: z.number().int().min(1).max(31).nullish(),
  saldoRestante: z.number().min(0).optional(),
};

/**
 * Discriminated union por tipo (sección 5): la tarjeta exige límite y el BNPL
 * exige plataforma, número de cuotas y frecuencia.
 */
export const deudaCrearSchema = z.discriminatedUnion("tipo", [
  z.object({
    ...deudaBase,
    tipo: z.literal("TARJETA"),
    limite: z.number().positive("El límite es obligatorio en una tarjeta"),
  }),
  z.object({
    ...deudaBase,
    tipo: z.literal("PRESTAMO_CUOTAS"),
    numeroCuotas: z.number().int().positive("Indica en cuántas cuotas se paga"),
    frecuenciaCuota: frecuenciaCuotaSchema.default("MENSUAL"),
  }),
  z.object({
    ...deudaBase,
    tipo: z.literal("PRESTAMO_INFORMAL"),
  }),
  z.object({
    ...deudaBase,
    tipo: z.literal("BNPL"),
    plataformaBnpl: z.string().trim().min(1, "Indica la plataforma (Cashea, Krece…)"),
    numeroCuotas: z.number().int().positive("Indica el número de cuotas"),
    frecuenciaCuota: frecuenciaCuotaSchema,
    nivelUsuario: z.string().nullish(),
    pctInicial: z.number().min(0).max(100).nullish(),
    penalidadPorAtraso: z.number().min(0).nullish(),
    comercioAfiliado: z.string().nullish(),
    producto: z.string().nullish(),
    fechaCompra: fechaIso.optional(),
    /** Genera los compromisos de cada cuota futura al crear la deuda. */
    generarCuotas: z.boolean().default(true),
  }),
]);

export const deudaEditarSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  entidad: z.string().trim().min(1).optional(),
  saldoRestante: z.number().min(0).optional(),
  limite: z.number().positive().nullish(),
  tasaInteresMensual: z.number().min(0).nullish(),
  pagoMinimoMensual: z.number().min(0).nullish(),
  fechaProximoPago: fechaIso.nullish(),
  activa: z.boolean().optional(),
});

export const pagoDeudaSchema = z.object({
  cuentaId: z.string().min(1, "La cuenta es obligatoria"),
  monto: z.number().positive("El monto debe ser mayor a cero"),
  fecha: fechaIso.optional(),
  interesIncluido: z.number().min(0).nullish(),
  penalidadIncluida: z.number().min(0).nullish(),
  categoriaId: z.string().nullish(),
});
