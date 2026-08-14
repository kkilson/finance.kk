-- CreateEnum
CREATE TYPE "TipoRegla" AS ENUM ('PAGO_POR_VENCER', 'PAGO_ATRASADO', 'INGRESO_ESPERADO_HOY', 'COBERTURA_EN_ROJO', 'RITMO_DE_GASTO_ALTO', 'TARJETA_CERCA_DEL_LIMITE', 'CUOTA_BNPL_POR_VENCER', 'CAPACIDAD_EXCEDIDA');

-- CreateEnum
CREATE TYPE "PlataformaDispositivo" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "NotificacionConfig" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "regla" "TipoRegla" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "parametro" DECIMAL(8,2),
    "horaDesde" INTEGER NOT NULL DEFAULT 8,
    "horaHasta" INTEGER NOT NULL DEFAULT 21,

    CONSTRAINT "NotificacionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "plataforma" "PlataformaDispositivo" NOT NULL DEFAULT 'WEB',
    "endpoint" TEXT NOT NULL,
    "claveP256dh" TEXT,
    "claveAuth" TEXT,
    "etiqueta" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUso" TIMESTAMP(3),

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionEnviada" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "regla" "TipoRegla" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "claveDedup" TEXT NOT NULL,
    "enviadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregada" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "dispositivoId" TEXT,

    CONSTRAINT "NotificacionEnviada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionConfig_usuarioId_regla_key" ON "NotificacionConfig"("usuarioId", "regla");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoPush_endpoint_key" ON "DispositivoPush"("endpoint");

-- CreateIndex
CREATE INDEX "NotificacionEnviada_usuarioId_regla_enviadaEn_idx" ON "NotificacionEnviada"("usuarioId", "regla", "enviadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionEnviada_usuarioId_claveDedup_key" ON "NotificacionEnviada"("usuarioId", "claveDedup");

-- AddForeignKey
ALTER TABLE "NotificacionConfig" ADD CONSTRAINT "NotificacionConfig_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionEnviada" ADD CONSTRAINT "NotificacionEnviada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionEnviada" ADD CONSTRAINT "NotificacionEnviada_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoPush"("id") ON DELETE SET NULL ON UPDATE CASCADE;
