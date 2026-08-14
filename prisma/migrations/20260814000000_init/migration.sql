-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('BANCO', 'WALLET', 'EFECTIVO', 'CRIPTO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('BS', 'USD');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('GASTO', 'INGRESO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'GASTO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoDeuda" AS ENUM ('TARJETA', 'PRESTAMO_CUOTAS', 'PRESTAMO_INFORMAL', 'BNPL');

-- CreateEnum
CREATE TYPE "FrecuenciaCuota" AS ENUM ('MENSUAL', 'QUINCENAL');

-- CreateEnum
CREATE TYPE "TipoCompromiso" AS ENUM ('PAGO', 'INGRESO_ESPERADO');

-- CreateEnum
CREATE TYPE "EstadoCompromiso" AS ENUM ('PENDIENTE', 'PAGADO', 'COBRADO', 'ATRASADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "monedaReferenciaDefault" "Moneda" NOT NULL DEFAULT 'USD',
    "saldoMinimoSeguridad" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "umbralEndeudamiento" DECIMAL(4,2) NOT NULL DEFAULT 0.35,
    "pctPagoMinimoTarjeta" DECIMAL(4,2) NOT NULL DEFAULT 0.10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "saldoActual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "favorita" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL,
    "grupoId" TEXT,
    "icono" TEXT,
    "color" TEXT,
    "esRecurrenteDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "cuentaDestinoId" TEXT,
    "categoriaId" TEXT,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "tasaCambioAplicada" DECIMAL(10,4),
    "fecha" TIMESTAMP(3) NOT NULL,
    "nota" TEXT,
    "esFijo" BOOLEAN NOT NULL DEFAULT false,
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "esExtraordinario" BOOLEAN NOT NULL DEFAULT false,
    "compromisoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeudaPrestamo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDeuda" NOT NULL,
    "entidad" TEXT NOT NULL,
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "saldoRestante" DECIMAL(14,2) NOT NULL,
    "tasaInteresMensual" DECIMAL(6,4),
    "moneda" "Moneda" NOT NULL,
    "limite" DECIMAL(14,2),
    "pagoMinimoMensual" DECIMAL(14,2),
    "fechaProximoPago" TIMESTAMP(3),
    "diaCierre" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "plataformaBnpl" TEXT,
    "nivelUsuario" TEXT,
    "pctInicial" DECIMAL(5,2),
    "numeroCuotas" INTEGER,
    "frecuenciaCuota" "FrecuenciaCuota" NOT NULL DEFAULT 'MENSUAL',
    "penalidadPorAtraso" DECIMAL(14,2),
    "comercioAfiliado" TEXT,
    "producto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeudaPrestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoDeuda" (
    "id" TEXT NOT NULL,
    "deudaId" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "interesIncluido" DECIMAL(14,2),
    "penalidadIncluida" DECIMAL(14,2),

    CONSTRAINT "PagoDeuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompromisoPresupuesto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoCompromiso" NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoriaId" TEXT,
    "deudaId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "fechaEsperada" TIMESTAMP(3) NOT NULL,
    "mesPeriodo" TEXT NOT NULL,
    "estado" "EstadoCompromiso" NOT NULL DEFAULT 'PENDIENTE',
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompromisoPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TasaCambio" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorBsPorUsd" DECIMAL(10,4) NOT NULL,
    "fuente" TEXT NOT NULL,

    CONSTRAINT "TasaCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Cuenta_usuarioId_idx" ON "Cuenta"("usuarioId");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_idx" ON "Categoria"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_compromisoId_key" ON "Movimiento"("compromisoId");

-- CreateIndex
CREATE INDEX "Movimiento_usuarioId_fecha_idx" ON "Movimiento"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "Movimiento_categoriaId_idx" ON "Movimiento"("categoriaId");

-- CreateIndex
CREATE INDEX "DeudaPrestamo_usuarioId_idx" ON "DeudaPrestamo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PagoDeuda_movimientoId_key" ON "PagoDeuda"("movimientoId");

-- CreateIndex
CREATE INDEX "CompromisoPresupuesto_usuarioId_mesPeriodo_idx" ON "CompromisoPresupuesto"("usuarioId", "mesPeriodo");

-- AddForeignKey
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_compromisoId_fkey" FOREIGN KEY ("compromisoId") REFERENCES "CompromisoPresupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaPrestamo" ADD CONSTRAINT "DeudaPrestamo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoDeuda" ADD CONSTRAINT "PagoDeuda_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "DeudaPrestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoDeuda" ADD CONSTRAINT "PagoDeuda_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPresupuesto" ADD CONSTRAINT "CompromisoPresupuesto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPresupuesto" ADD CONSTRAINT "CompromisoPresupuesto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPresupuesto" ADD CONSTRAINT "CompromisoPresupuesto_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "DeudaPrestamo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
