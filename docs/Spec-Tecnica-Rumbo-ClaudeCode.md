# Especificación Técnica — Rumbo (Finanzas Personales)

**Para:** handoff a Claude Code
**Basado en:** PRD-Rumbo-Finanzas-Personales.md (v1.0)
**Alcance de este documento:** Fase 0 a Fase 3 (backend + web funcional con dashboard, movimientos, presupuesto, cuentas, deudas incluyendo BNPL). Las Fases 4-6 (notificaciones push, importación, Flutter) tienen su propia sección al final con menor nivel de detalle, para no bloquear el arranque.

---

## 1. Stack y decisiones fijas

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend + Web | Next.js 14+ (App Router), TypeScript | Un solo repo sirve API y frontend; consistente con otras herramientas de Deepcompany |
| ORM / DB | Prisma + PostgreSQL 15+ | Migraciones versionadas, tipado end-to-end |
| Autenticación | NextAuth (credentials) o JWT propio simple | Un solo usuario en v1 — no sobre-construir |
| Frontend UI | React + Tailwind CSS | Reutilizar tokens de diseño del prototipo `rumbo-finanzas-prototipo.html` |
| Gráficos | Chart.js (react-chartjs-2) | Ya usado en el prototipo, evita reescribir |
| Fechas | `date-fns` (con locale `es`) | Manejo de quincenas, meses, recurrencias |
| Validación | Zod | Validar payloads de API y forms |
| Hosting | Proxmox (clúster interno, 3 nodos / 48GB) | Ya existe, sin costo adicional |
| Contenedor | Docker + docker-compose (app + Postgres) | Despliegue reproducible en Proxmox |

**No usar en v1:** microservicios separados, colas de mensajería (Redis/RabbitMQ) — el volumen de datos de un solo usuario no lo justifica. Si en el futuro se vuelve multiusuario, revisar esta decisión.

---

## 2. Estructura de carpetas

```
rumbo/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                    # carga el set de categorías del Anexo A del PRD
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── movimientos/page.tsx
│   │   │   ├── presupuesto/page.tsx
│   │   │   ├── cuentas/page.tsx
│   │   │   ├── deudas/page.tsx
│   │   │   ├── categorias/page.tsx
│   │   │   └── ajustes/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── cuentas/route.ts
│   │       ├── cuentas/[id]/route.ts
│   │       ├── movimientos/route.ts
│   │       ├── movimientos/[id]/route.ts
│   │       ├── categorias/route.ts
│   │       ├── categorias/[id]/route.ts
│   │       ├── presupuesto/route.ts
│   │       ├── presupuesto/compromisos/route.ts
│   │       ├── presupuesto/compromisos/[id]/marcar-pagado/route.ts
│   │       ├── deudas/route.ts
│   │       ├── deudas/[id]/route.ts
│   │       ├── deudas/[id]/pagos/route.ts
│   │       ├── tasa-cambio/route.ts
│   │       └── indicadores/
│   │           ├── dias-cobertura/route.ts
│   │           └── capacidad-endeudamiento/route.ts
│   ├── lib/
│   │   ├── prisma.ts               # cliente Prisma singleton
│   │   ├── auth.ts
│   │   ├── moneda.ts               # conversión Bs↔USD
│   │   └── calculos/
│   │       ├── dias-cobertura.ts
│   │       ├── capacidad-endeudamiento.ts
│   │       └── proyeccion-mes.ts
│   ├── components/
│   │   ├── dashboard/              # KpiCard, GaugeCobertura, ChartCategorias...
│   │   ├── presupuesto/            # CalendarioMes, TablaCompromisos...
│   │   ├── deudas/                 # DeudaCard, FormBNPL...
│   │   └── ui/                     # Button, Chip, Modal... (basado en el prototipo)
│   └── types/
│       └── index.ts
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

## 3. Esquema Prisma completo

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TipoCuenta {
  BANCO
  WALLET
  EFECTIVO
  CRIPTO
}

enum Moneda {
  BS
  USD
}

enum TipoCategoria {
  GASTO
  INGRESO
}

enum TipoMovimiento {
  INGRESO
  GASTO
  TRANSFERENCIA
}

enum TipoDeuda {
  TARJETA
  PRESTAMO_CUOTAS
  PRESTAMO_INFORMAL
  BNPL
}

enum FrecuenciaCuota {
  MENSUAL
  QUINCENAL
}

enum TipoCompromiso {
  PAGO
  INGRESO_ESPERADO
}

enum EstadoCompromiso {
  PENDIENTE
  PAGADO
  COBRADO
  ATRASADO
}

model Usuario {
  id                      String    @id @default(cuid())
  nombre                  String
  email                   String    @unique
  passwordHash            String
  monedaReferenciaDefault Moneda    @default(USD)
  saldoMinimoSeguridad    Decimal   @default(0) @db.Decimal(12, 2)
  umbralEndeudamiento     Decimal   @default(0.35) @db.Decimal(4, 2)
  createdAt               DateTime  @default(now())

  cuentas       Cuenta[]
  categorias    Categoria[]
  movimientos   Movimiento[]
  deudas        DeudaPrestamo[]
  compromisos   CompromisoPresupuesto[]
}

model Cuenta {
  id        String     @id @default(cuid())
  usuarioId String
  usuario   Usuario    @relation(fields: [usuarioId], references: [id])
  nombre    String
  tipo      TipoCuenta
  moneda    Moneda
  saldoActual Decimal  @default(0) @db.Decimal(14, 2)
  favorita  Boolean    @default(false)
  activa    Boolean    @default(true)
  createdAt DateTime   @default(now())

  movimientos Movimiento[]
}

model Categoria {
  id                  String        @id @default(cuid())
  usuarioId           String
  usuario             Usuario       @relation(fields: [usuarioId], references: [id])
  nombre              String
  tipo                TipoCategoria
  grupoId             String?
  grupo               Categoria?    @relation("GrupoSubcategorias", fields: [grupoId], references: [id])
  subcategorias       Categoria[]   @relation("GrupoSubcategorias")
  icono               String?
  color               String?
  esRecurrenteDefault Boolean       @default(false)
  archivada           Boolean       @default(false)

  movimientos Movimiento[]
  compromisos CompromisoPresupuesto[]
}

model Movimiento {
  id               String          @id @default(cuid())
  usuarioId        String
  usuario          Usuario         @relation(fields: [usuarioId], references: [id])
  cuentaId         String
  cuenta           Cuenta          @relation(fields: [cuentaId], references: [id])
  categoriaId      String?
  categoria        Categoria?      @relation(fields: [categoriaId], references: [id])
  tipo             TipoMovimiento
  monto            Decimal         @db.Decimal(14, 2)
  moneda           Moneda
  tasaCambioAplicada Decimal?      @db.Decimal(10, 4)
  fecha            DateTime
  nota             String?
  esFijo           Boolean         @default(false)
  esRecurrente     Boolean         @default(false)
  compromisoId     String?         @unique
  compromiso       CompromisoPresupuesto? @relation(fields: [compromisoId], references: [id])
  createdAt        DateTime        @default(now())

  pagosDeuda PagoDeuda[]

  @@index([usuarioId, fecha])
  @@index([categoriaId])
}

model DeudaPrestamo {
  id                  String          @id @default(cuid())
  usuarioId           String
  usuario             Usuario         @relation(fields: [usuarioId], references: [id])
  nombre              String
  tipo                TipoDeuda
  entidad             String
  montoOriginal       Decimal         @db.Decimal(14, 2)
  saldoRestante       Decimal         @db.Decimal(14, 2)
  tasaInteresMensual  Decimal?        @db.Decimal(6, 4)
  moneda              Moneda
  limite              Decimal?        @db.Decimal(14, 2)
  fechaProximoPago    DateTime?
  diaCierre           Int?
  activa              Boolean         @default(true)

  // Campos específicos BNPL (Cashea, Krece, Chollo, Lysto)
  plataformaBnpl      String?
  nivelUsuario         String?
  pctInicial          Decimal?        @db.Decimal(5, 2)
  numeroCuotas        Int?
  frecuenciaCuota     FrecuenciaCuota @default(MENSUAL)
  penalidadPorAtraso  Decimal?        @db.Decimal(14, 2)
  comercioAfiliado    String?
  producto            String?

  createdAt DateTime @default(now())
  pagos     PagoDeuda[]
}

model PagoDeuda {
  id               String        @id @default(cuid())
  deudaId          String
  deuda            DeudaPrestamo @relation(fields: [deudaId], references: [id])
  movimientoId     String        @unique
  movimiento       Movimiento    @relation(fields: [movimientoId], references: [id])
  monto            Decimal       @db.Decimal(14, 2)
  fecha            DateTime
  interesIncluido  Decimal?      @db.Decimal(14, 2)
  penalidadIncluida Decimal?     @db.Decimal(14, 2)
}

model CompromisoPresupuesto {
  id             String            @id @default(cuid())
  usuarioId      String
  usuario        Usuario           @relation(fields: [usuarioId], references: [id])
  tipo           TipoCompromiso
  concepto       String
  categoriaId    String?
  categoria      Categoria?        @relation(fields: [categoriaId], references: [id])
  monto          Decimal           @db.Decimal(14, 2)
  moneda         Moneda
  fechaEsperada  DateTime
  mesPeriodo     String            // formato "2026-08"
  estado         EstadoCompromiso  @default(PENDIENTE)
  esRecurrente   Boolean           @default(false)

  movimiento Movimiento?

  @@index([usuarioId, mesPeriodo])
}

model TasaCambio {
  id       String   @id @default(cuid())
  fecha    DateTime @default(now())
  valorBsPorUsd Decimal @db.Decimal(10, 4)
  fuente   String   // BCV | paralelo | manual
}
```

> Las tablas de notificaciones (`NotificacionConfig`, `DispositivoPush`, `NotificacionEnviada`) se agregan en la Fase 4 — ver sección 9. No incluirlas en la migración inicial para no cargar el modelo con algo que no se usa todavía.

---

## 4. Lógica de cálculo — implementación

Estas tres funciones son el corazón del producto. Deben vivir en `src/lib/calculos/` como funciones puras, testeables sin necesidad de un request HTTP, y ser consumidas tanto por los endpoints de indicadores como por el dashboard.

### 4.1 `dias-cobertura.ts`

```ts
interface DiasCoberturaResult {
  balanceDisponible: number;
  gastoDiarioPromedio: number;
  diasCobertura: number;
  diasHastaProximoIngresoFijo: number | null;
  estado: "verde" | "amarillo" | "rojo";
}

async function calcularDiasCobertura(usuarioId: string): Promise<DiasCoberturaResult> {
  // 1. Sumar saldoActual de todas las cuentas activas, convertidas a moneda de referencia
  // 2. Restar compromisos PENDIENTE del mesPeriodo actual (tipo PAGO)
  // 3. Gasto diario promedio = SUM(movimientos GASTO últimos 30 días, excluyendo notas marcadas "extraordinario")
  //    dividido entre 30
  // 4. diasCobertura = balanceDisponible / gastoDiarioPromedio
  // 5. Buscar el CompromisoPresupuesto tipo INGRESO_ESPERADO más próximo
  //    donde el movimiento origen (si existe) tenga esFijo = true
  // 6. Comparar y asignar estado:
  //    - rojo si diasCobertura < diasHastaProximoIngresoFijo
  //    - amarillo si la diferencia es de 1 a 3 días
  //    - verde en otro caso
}
```

**Casos borde a manejar explícitamente:**
- Si no hay gastos registrados en 30 días → usar los últimos N movimientos disponibles (mínimo 5) o mostrar el estado como "sin datos suficientes" en vez de dividir por cero.
- Si no hay ningún ingreso fijo próximo registrado → `diasHastaProximoIngresoFijo = null` y el estado se basa solo en si `diasCobertura` es positivo o no.

### 4.2 `capacidad-endeudamiento.ts`

```ts
interface CapacidadEndeudamientoResult {
  ingresoFijoMensual: number;
  compromisosDeudaActuales: number;
  ratioEndeudamientoActual: number;
  umbralMaximoRecomendado: number;
  capacidadDisponible: number;
  estado: "disponible" | "en_limite" | "excedido";
}
```

- `ingresoFijoMensual`: promedio de movimientos `INGRESO` con `esFijo = true` de los últimos 3 meses.
- `compromisosDeudaActuales`: para cada `DeudaPrestamo` activa, normalizar a costo mensual:
  - Tarjeta: pago mínimo estimado (si no está registrado explícitamente, usar un % configurable del saldo usado, default 10%).
  - Préstamo con cuotas: `montoOriginal / numeroCuotas`, ajustado si `frecuenciaCuota = QUINCENAL` (multiplicar por ~2.15 para llevarlo a equivalente mensual).
  - BNPL: mismo tratamiento que préstamo con cuotas, usando `numeroCuotas` y `frecuenciaCuota`.
- `umbralMaximoRecomendado` viene de `Usuario.umbralEndeudamiento` (default 0.35).
- Si `ratioEndeudamientoActual >= umbralMaximoRecomendado` → estado `excedido`, `capacidadDisponible` se muestra como 0 (no negativo, para no confundir en la UI).

### 4.3 `proyeccion-mes.ts`

```ts
interface ProyeccionMesResult {
  balanceActual: number;
  ingresosEsperadosNoCobrados: number;
  pagosPendientesNoPagados: number;
  proyeccionBalanceFinMes: number;
}
```

Consulta directa sobre `CompromisoPresupuesto` filtrando por `mesPeriodo` actual y `estado = PENDIENTE`.

---

## 5. Especificación de endpoints clave

Todos los endpoints requieren sesión autenticada (excepto `/auth/login`). Respuestas en JSON, errores con formato `{ error: string, campo?: string }` y status HTTP correspondiente (400 validación, 401 no autenticado, 404 no encontrado, 500 error de servidor).

### `POST /api/movimientos`

```ts
// Request body (validado con Zod)
{
  cuentaId: string,
  categoriaId?: string,
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA",
  monto: number,          // > 0
  moneda: "BS" | "USD",
  fecha: string,          // ISO date, default: hoy
  nota?: string,
  esFijo?: boolean,       // solo aplica si tipo === "INGRESO"
  esRecurrente?: boolean,
  cuentaDestinoId?: string // requerido si tipo === "TRANSFERENCIA"
}
```

Lógica del handler:
1. Validar payload con Zod.
2. Si `tipo === "TRANSFERENCIA"`: crear dos movimientos internamente o un solo registro con flag — decisión de implementación: usar un único `Movimiento` tipo `TRANSFERENCIA` con `cuentaId` (origen) y un campo adicional `cuentaDestinoId` en el modelo (agregar si no está en el esquema base), y actualizar ambos saldos en una transacción Prisma (`prisma.$transaction`).
3. Obtener la tasa de cambio vigente (`TasaCambio` más reciente) y guardarla en `tasaCambioAplicada` — esto es lo que congela el valor histórico (sección 6.4 del PRD).
4. Actualizar `Cuenta.saldoActual` (sumar si ingreso, restar si gasto) dentro de la misma transacción.
5. Si el movimiento viene de marcar un compromiso como pagado (`compromisoId` presente), actualizar `CompromisoPresupuesto.estado = PAGADO/COBRADO`.
6. Retornar el movimiento creado con sus relaciones (`cuenta`, `categoria`) incluidas.

### `GET /api/indicadores/dias-cobertura`

Simplemente invoca `calcularDiasCobertura(usuarioId)` y retorna el resultado. Sin lógica adicional en el route handler — toda la lógica vive en `lib/calculos`.

### `PATCH /api/presupuesto/compromisos/:id/marcar-pagado`

```ts
// Request body
{ cuentaId: string, fecha?: string }  // fecha default: hoy
```

1. Buscar el `CompromisoPresupuesto` por id.
2. Crear un `Movimiento` correspondiente (tipo `PAGO` → `GASTO`, `INGRESO_ESPERADO` → `INGRESO`) usando la cuenta indicada.
3. Vincular `movimiento.compromisoId = compromiso.id`.
4. Actualizar `compromiso.estado` según corresponda.
5. Si el compromiso está vinculado a una `DeudaPrestamo` (pago de cuota), crear también el `PagoDeuda` y actualizar `saldoRestante`.

### `POST /api/presupuesto/copiar-mes-anterior`

```ts
// Request body
{ mesOrigen: string, mesDestino: string }  // formato "2026-08"
```

Duplica todos los `CompromisoPresupuesto` del mes origen donde `esRecurrente = true`, ajustando `fechaEsperada` al mes destino (mismo día del mes, o el día hábil más cercano si no existe) y `estado = PENDIENTE`.

### `POST /api/deudas` (creación, con foco en BNPL)

```ts
{
  nombre: string,
  tipo: "TARJETA" | "PRESTAMO_CUOTAS" | "PRESTAMO_INFORMAL" | "BNPL",
  entidad: string,
  montoOriginal: number,
  moneda: "BS" | "USD",
  tasaInteresMensual?: number,
  limite?: number,               // tarjetas
  // BNPL:
  plataformaBnpl?: "Cashea" | "Krece" | "Chollo" | "Lysto" | string,
  nivelUsuario?: string,
  pctInicial?: number,
  numeroCuotas?: number,
  frecuenciaCuota?: "MENSUAL" | "QUINCENAL",
  penalidadPorAtraso?: number,
  comercioAfiliado?: string,
  producto?: string
}
```

Validación con Zod usando un discriminated union por `tipo`: si `tipo === "BNPL"`, `plataformaBnpl`, `numeroCuotas` y `frecuenciaCuota` son obligatorios; si `tipo === "TARJETA"`, `limite` es obligatorio.

Al crear una deuda BNPL, generar automáticamente los `CompromisoPresupuesto` de cada cuota futura (usando `numeroCuotas` y `frecuenciaCuota = QUINCENAL` para calcular las fechas cada 14-15 días desde la fecha de compra), en vez de esperar a que el usuario los cree uno por uno.

---

## 6. Frontend — consideraciones de implementación

- Reusar exactamente los tokens de color/tipografía del prototipo (`rumbo-finanzas-prototipo.html`): fuente Outfit para títulos, Inter para texto, IBM Plex Mono para cifras, paleta teal/gold/danger/success ya definida ahí. Extraer esas variables CSS a `tailwind.config.ts` como `theme.extend.colors`.
- El gauge de días de cobertura (SVG con `stroke-dasharray`) se puede portar casi directo del prototipo a un componente React, parametrizando el porcentaje según el valor real que devuelve `/api/indicadores/dias-cobertura`.
- El calendario de presupuesto: en el prototipo está hardcodeado; en la versión real debe generarse dinámicamente a partir de `CompromisoPresupuesto` del `mesPeriodo` consultado, marcando los días con `fechaEsperada` correspondiente. Para las cuotas BNPL quincenales, van a aparecer más seguido que los pagos mensuales — el diseño del calendario ya soporta múltiples tags por día, no requiere cambio visual.
- Formulario de nuevo movimiento: 3 campos obligatorios visibles primero (monto, cuenta, categoría), resto colapsado en "más detalles" — para cumplir el requisito de "registro en 3 toques" del PRD (sección 9).
- Formulario de nueva deuda: mostrar/ocultar campos BNPL dinámicamente según el `tipo` seleccionado (usar el mismo patrón condicional que la validación Zod del backend).

---

## 7. Variables de entorno

```
DATABASE_URL="postgresql://usuario:password@localhost:5432/rumbo"
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://rumbo.tudominio.com"
DEFAULT_MONEDA_REFERENCIA="USD"
```

(Las variables de FCM/Web Push se agregan en Fase 4, ver sección 9.)

---

## 8. Orden de construcción sugerido (para Claude Code)

1. Inicializar el proyecto Next.js + TypeScript + Tailwind + Prisma.
2. Escribir `schema.prisma` completo (sección 3) y correr la primera migración.
3. Escribir `seed.ts` con el set de categorías del Anexo A del PRD.
4. Implementar autenticación mínima (un solo usuario, login con email/password).
5. Endpoints CRUD de `Cuenta` y `Categoria` (los más simples, sin lógica de negocio) + páginas correspondientes.
6. Endpoint `POST /movimientos` con la lógica de transacción y actualización de saldo — este es el primer punto donde vale la pena escribir un test automatizado, porque un bug acá corrompe balances.
7. Página de Dashboard con KPIs básicos (sin gauge todavía, solo sumas).
8. Implementar `lib/calculos/dias-cobertura.ts` con sus tests, y conectar el gauge del dashboard.
9. Módulo de Presupuesto: `CompromisoPresupuesto`, calendario, marcar como pagado.
10. Módulo de Deudas: primero tipos tarjeta/préstamo/informal, después BNPL con generación automática de cuotas.
11. Implementar `capacidad-endeudamiento.ts` y conectar al módulo de deudas.
12. Pulido visual final comparando cada pantalla contra el prototipo HTML.

Este orden prioriza tener algo usable (registrar movimientos y ver el dashboard) antes de construir los módulos más complejos (deudas BNPL, capacidad de endeudamiento).

---

## 9. Fases 4-6 (resumen, para no bloquear el arranque)

### Fase 4 — Notificaciones push
- Agregar al esquema: `NotificacionConfig`, `DispositivoPush`, `NotificacionEnviada` (campos ya definidos en el PRD, sección 5).
- Web Push: implementar Service Worker (`public/sw.js`) + librería `web-push` en el backend para enviar.
- Job programado: usar un cron simple (`node-cron` dentro del propio proceso Next.js, o un contenedor separado con `node-cron`/`cron` de sistema en Docker) que corra cada hora y evalúe las 8 reglas de la tabla de la sección 4.6 del PRD contra los datos actuales, generando `NotificacionEnviada` y disparando el push correspondiente.
- Variables de entorno adicionales: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (Web Push), `FIREBASE_SERVICE_ACCOUNT_JSON` (cuando se agregue Flutter en Fase 6).

### Fase 5 — Importación de historial
- Endpoint `POST /movimientos/importar` que acepte CSV/XLSX (usar `papaparse` o `xlsx` según formato), con un paso de mapeo de columnas antes de confirmar la importación (para adaptarse al formato del Excel actual del usuario sin asumir nombres de columna fijos).

### Fase 6 — App Flutter
- Consumir la misma API REST ya construida; no crear endpoints paralelos.
- Estado local con `Hive` o `sqflite` para soporte offline; cola de sincronización simple (los movimientos creados offline se marcan `pendienteSync = true` y se envían al recuperar conexión).
- FCM para push nativo, reutilizando la misma tabla `DispositivoPush` (diferenciando por campo `plataforma`).

---

## 10. Qué NO construir todavía

Para mantener el alcance manejable en un handoff a Claude Code, evitar explícitamente en esta primera pasada:
- Multiusuario / permisos por rol.
- Integración automática con la tasa BCV/paralelo (queda manual vía `POST /tasa-cambio` hasta que se resuelva la Decisión Abierta #1 del PRD).
- Cualquier tipo de conexión bancaria automática.
- Exportación de reportes PDF/Excel (Decisión Abierta #4 del PRD).
