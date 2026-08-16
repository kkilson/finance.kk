export type Moneda = "BS" | "USD";
export type TipoCuenta = "BANCO" | "WALLET" | "EFECTIVO" | "CRIPTO";
export type TipoCategoria = "GASTO" | "INGRESO";
export type TipoMovimiento = "INGRESO" | "GASTO" | "TRANSFERENCIA";

/** Formas serializadas (Decimal -> number, Date -> string ISO) que devuelve la API. */
export interface CuentaDTO {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  saldoActual: number;
  favorita: boolean;
  activa: boolean;
}

export interface CategoriaDTO {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  grupoId: string | null;
  icono: string | null;
  color: string | null;
  esRecurrenteDefault: boolean;
  archivada: boolean;
}

export interface MovimientoDTO {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  moneda: Moneda;
  fecha: string;
  nota: string | null;
  esFijo: boolean;
  esRecurrente: boolean;
  esExtraordinario: boolean;
  cuenta: CuentaDTO;
  cuentaDestino: CuentaDTO | null;
  categoria: CategoriaDTO | null;
}

export type TipoCompromiso = "PAGO" | "INGRESO_ESPERADO";
export type EstadoCompromiso = "PENDIENTE" | "PAGADO" | "COBRADO" | "ATRASADO";
export type TipoDeuda = "TARJETA" | "PRESTAMO_CUOTAS" | "PRESTAMO_INFORMAL" | "BNPL";
export type FrecuenciaCuota = "MENSUAL" | "QUINCENAL";

export interface CompromisoDTO {
  id: string;
  tipo: TipoCompromiso;
  concepto: string;
  monto: number;
  moneda: Moneda;
  fechaEsperada: string;
  mesPeriodo: string;
  estado: EstadoCompromiso;
  esRecurrente: boolean;
  categoria: CategoriaDTO | null;
  deuda: { id: string; nombre: string } | null;
}

export interface PresupuestoDTO {
  mesPeriodo: string;
  monedaReferencia: Moneda;
  compromisos: CompromisoDTO[];
  totales: {
    presupuestado: number;
    pagado: number;
    pendiente: number;
    totalCompromisos: number;
    compromisosSaldados: number;
  };
}

export interface DeudaDTO {
  id: string;
  nombre: string;
  tipo: TipoDeuda;
  entidad: string;
  montoOriginal: number;
  saldoRestante: number;
  tasaInteresMensual: number | null;
  moneda: Moneda;
  limite: number | null;
  pagoMinimoMensual: number | null;
  fechaProximoPago: string | null;
  activa: boolean;
  plataformaBnpl: string | null;
  nivelUsuario: string | null;
  pctInicial: number | null;
  numeroCuotas: number | null;
  frecuenciaCuota: FrecuenciaCuota;
  producto: string | null;
  comercioAfiliado: string | null;
  pagos?: PagoDeudaDTO[];
}

export interface PagoDeudaDTO {
  id: string;
  monto: number;
  fecha: string;
  interesIncluido: number | null;
  penalidadIncluida: number | null;
}

export interface CapacidadDTO {
  ingresoFijoMensual: number;
  compromisosDeudaActuales: number;
  ratioEndeudamientoActual: number;
  umbralMaximoRecomendado: number;
  capacidadDisponible: number;
  estado: "disponible" | "en_limite" | "excedido" | "sin_datos";
  monedaReferencia: Moneda;
  detalle: { nombre: string; costoMensual: number }[];
}

export interface TasaCambioDTO {
  id: string;
  fecha: string;
  valorBsPorUsd: number;
  fuente: string;
}
