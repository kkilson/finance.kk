# Rumbo

Finanzas personales en bolívares y dólares. Implementación de
[la spec técnica](docs/Spec-Tecnica-Rumbo-ClaudeCode.md), fases 0 a 5: cuentas, movimientos,
dashboard con días de cobertura, presupuesto mensual, deudas (incluyendo BNPL
tipo Cashea/Krece con generación automática de cuotas), notificaciones push e
importación del historial desde CSV/XLSX.

En `docs/` están la spec técnica, el prototipo visual en HTML y las capturas de
referencia.

## Requisitos

- Node 22+
- PostgreSQL 15+ **con encoding UTF8** (o Docker, ver abajo)

> El encoding importa: los íconos de las categorías son emoji y una base creada
> en WIN1252 o LATIN1 los rechaza al insertar. Verifícalo con
> `SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname='rumbo';`

## Arrancar en local

1. Levantar Postgres. Con Docker:

```bash
docker compose up -d db
```

Sin Docker, crea la base explícitamente en UTF8:

```bash
createdb -E UTF8 -T template0 rumbo
```

2. Configurar el entorno:

```bash
cp .env.example .env
```

Edita `.env`: `DATABASE_URL` y un `AUTH_SECRET` largo y aleatorio.

3. Crear el esquema y cargar las categorías:

```bash
npx prisma migrate deploy
npm run db:seed
```

El seed crea el usuario `yo@rumbo.local` / `rumbo1234` (cámbialos con
`SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NOMBRE`), las 62 categorías del prototipo
y, si defines `SEED_TASA`, una tasa de cambio inicial.

4. Arrancar:

```bash
npm run dev
```

## Desplegar en Vercel + Supabase

### 1. Supabase

Crear el proyecto y copiar las cadenas de conexión (Project Settings →
Database). Hacen falta dos, y **ninguna de las dos es la que Supabase muestra
primero**:

| Variable | Cadena | Para qué |
|---|---|---|
| `DATABASE_URL` | Transaction pooler, puerto **6543** | La app en runtime |
| `DIRECT_URL` | Session pooler, puerto **5432** | Migraciones y seed |

El host `db.<ref>.supabase.co` que aparece como "Direct connection" **resuelve
solo a IPv6**. No sirve ni desde una red doméstica típica ni desde Vercel, que
sale por IPv4. Las dos variables tienen que apuntar al host
`aws-N-<region>.pooler.supabase.com`, cambiando el puerto.

Los dos poolers no son intercambiables: el de transacción reparte cada consulta
entre conexiones distintas, así que `prisma migrate deploy` se queda colgado
contra él (los locks que usa son de sesión). Por eso las migraciones van por el
de sesión. En runtime, en cambio, el de transacción es el correcto, y el código
detecta solo que está hablando con él para desactivar los prepared statements;
sin eso las consultas fallan de forma intermitente.

Cargar el esquema y las categorías desde tu máquina:

```bash
npx prisma migrate deploy
npm run db:seed
```

Si tu red bloquea el puerto 5432 y no puedes usar el session pooler, las
migraciones se pueden aplicar a mano ejecutando cada `prisma/migrations/*/migration.sql`
y registrándolas en la tabla `_prisma_migrations` con el sha256 del archivo
como `checksum`.

### Cambiar la contraseña del usuario

El seed crea el usuario con la contraseña por defecto `rumbo1234`, que está
escrita acá y este repo es público. Cámbiala antes de exponer la app:

```bash
npm run pass:cambiar -- tu@correo.com "una contraseña larga"
```

Volver a correr el seed **no** la cambia: usa `upsert` y no toca el usuario
existente a propósito.

### 2. Vercel

Importar el repo y definir las variables de entorno del proyecto:

`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `TZ`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_SUBJECT`.

**`TZ=America/Caracas` no es opcional.** El runtime de Vercel corre en UTC, y
las franjas horarias de las notificaciones se evalúan con la hora local del
proceso: sin esa variable los avisos salen corridos cuatro horas y nada falla
de forma visible.

El `vercel-build` aplica las migraciones pendientes antes de compilar, pero
solo si `DIRECT_URL` apunta a algo que las soporte. Si falta o apunta al pooler
de transacción, avisa en el log y sigue con el build en vez de romper el
deploy — el precio es que el esquema puede quedar desactualizado, así que
conviene revisar ese aviso.

### 3. El cron en Vercel

`vercel.json` deja el job **una vez al día a las 8:00 de Venezuela** (12:00
UTC), porque el plan Hobby solo permite crons diarios y rechaza el deploy si
pides más. Con plan Pro cámbialo a `"0 * * * *"` para que corra cada hora, que
es lo que la Fase 4 asume. El contenedor `cron` del compose no se usa acá.

Vercel invoca el endpoint por GET con `Authorization: Bearer $CRON_SECRET`; el
worker de Docker lo hace por POST. El handler acepta los dos.

### Límites que impone serverless

- La subida de archivos está topada en **4 MB**: Vercel corta el cuerpo de una
  función en 4.5 MB y el error que devuelve el proxy no dice nada útil.
- El pool de conexiones se fuerza a 1 por instancia cuando detecta Vercel. Con
  un pool grande, unas pocas lambdas simultáneas agotan las conexiones de
  Supabase.

## Notificaciones push (Fase 4)

Generar el par de llaves VAPID una sola vez y pegarlo en `.env`:

```bash
npm run vapid:generar
```

Si las llaves cambian, las suscripciones existentes dejan de funcionar y hay
que volver a activar cada dispositivo. Además hace falta un `CRON_SECRET`, que
es lo único que protege `POST /api/cron/notificaciones`.

Con eso, en **Ajustes** aparece el botón para activar los avisos en el
dispositivo actual, el interruptor y umbral de cada regla, y el historial de lo
enviado. El botón "Evaluar ahora" corre el motor sin esperar al cron.

En producción el job horario es el contenedor `cron` del compose. En local:

```bash
npm run cron
```

Web Push exige HTTPS (salvo en `localhost`), así que en Proxmox hay que
servir la app detrás de TLS para que funcione desde el teléfono.

### Las 8 reglas

`PAGO_POR_VENCER`, `PAGO_ATRASADO`, `INGRESO_ESPERADO_HOY`, `COBERTURA_EN_ROJO`,
`RITMO_DE_GASTO_ALTO`, `TARJETA_CERCA_DEL_LIMITE`, `CUOTA_BNPL_POR_VENCER` y
`CAPACIDAD_EXCEDIDA`, en `src/lib/notificaciones/reglas.ts`.

> Son una lectura del producto, no las del PRD: la sección 4.6 define las
> oficiales y ese documento no está en la carpeta. Cada regla tiene umbral y
> franja horaria configurables, así que ajustarlas no toca código; si el PRD
> pide una regla distinta, se agrega al enum `TipoRegla` y a `evaluarReglas`.

Cada aviso lleva una clave de deduplicación, así el cron horario no repite el
mismo mensaje. Las notificaciones se registran aunque no haya dispositivo
suscrito, para que el historial muestre qué se habría avisado.

## Importar el historial (Fase 5)

En **Importar**: se sube el CSV o XLSX, la app propone qué columna es cuál (se
puede corregir), muestra las primeras filas y recién ahí escribe.

- Detecta el formato numérico latino (`1.234,56`) y el anglosajón, y reconoce
  que un `80.5` de un XLSX es un decimal, no miles.
- Fechas en ISO, `dd/mm/yyyy` y `dd-mm-yy`.
- Las categorías y cuentas se resuelven por nombre; si no existe la categoría,
  la fila entra sin categoría y queda avisado en el reporte.
- Cada movimiento guarda la tasa que estaba vigente **en su fecha**, no la de
  hoy, para no distorsionar el histórico.
- Con "saltar repetidos" activo, reimportar el mismo archivo no duplica nada.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests de la lógica de cálculo |
| `npm run db:migrate` | Nueva migración a partir de cambios en el schema |
| `npm run db:deploy` | Aplicar migraciones existentes |
| `npm run db:seed` | Usuario + categorías |
| `npm run db:studio` | Explorador de la base de datos |
| `npm run vapid:generar` | Par de llaves VAPID para Web Push |
| `npm run cron` | Job de notificaciones en local |
| `npm run pass:cambiar` | Cambiar la contraseña de un usuario |

## Estructura

- `src/lib/calculos/` — el corazón del producto. Cada indicador es una función
  pura (`computar*`) más un envoltorio que consulta la base (`calcular*`); los
  tests atacan las puras, sin necesidad de base de datos.
  - `dias-cobertura.ts` — cuántos días aguantas antes del próximo ingreso fijo.
  - `capacidad-endeudamiento.ts` — cuánta cuota mensual nueva puedes asumir.
  - `proyeccion-mes.ts` — con qué balance cierras el mes.
- `src/lib/servicios/` — escrituras con reglas de negocio:
  - `movimientos.ts` — único camino para crear o borrar un movimiento; ajusta
    saldos en una transacción y congela la tasa vigente.
  - `presupuesto.ts` — marcar pagado, copiar el mes anterior, marcar atrasados.
  - `deudas.ts` — alta de deudas y plan de cuotas BNPL.
- `src/app/api/` — REST, pensada para que la app Flutter de la Fase 6 consuma
  exactamente los mismos endpoints.
- `src/app/(app)/` — páginas. Los datos se cargan en el server component y las
  mutaciones pasan por la API.

## Decisiones que se desviaron de la spec

- **Autenticación:** JWT propio en cookie httpOnly (`jose` + `bcryptjs`) en vez
  de NextAuth. La spec lo permitía y para un solo usuario es menos superficie.
  Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`.
- **Tailwind v4:** los tokens del prototipo viven en `@theme` dentro de
  `globals.css`, no en `tailwind.config.ts` (v4 ya no usa ese archivo).
- **Prisma 7:** la URL de conexión va en `prisma.config.ts` y el cliente usa el
  adaptador `@prisma/adapter-pg`. El cliente generado queda en
  `src/generated/prisma`.
- **Campos añadidos al esquema:** `Movimiento.cuentaDestinoId` (transferencias,
  previsto en la sección 5), `Movimiento.esExtraordinario` (la sección 4.1 pedía
  excluir gastos extraordinarios del promedio; una nota de texto libre no es
  filtrable de forma confiable), `CompromisoPresupuesto.deudaId` (necesario para
  el paso 5 de "marcar pagado"), `DeudaPrestamo.pagoMinimoMensual` y
  `Usuario.pctPagoMinimoTarjeta` (configurable como pide la sección 4.2).
- **Un cuarto estado `sin_datos`** en días de cobertura y capacidad de
  endeudamiento. Los enums de la spec tienen tres estados, pero sin gastos
  registrados o sin ingreso fijo el cálculo sería una división por cero; es más
  honesto decir "no sé" que pintar un cero.
- **Editar un movimiento** solo permite campos que no afectan saldos (nota,
  fecha, categoría, banderas). Para cambiar monto, cuenta o tipo hay que borrar
  y volver a registrar, y así el ajuste de saldo pasa siempre por el mismo
  camino transaccional.

## Decisiones de dependencias

- **`exceljs` en vez de `xlsx`.** El `xlsx` de npm arrastra dos vulnerabilidades
  altas sin fix (prototype pollution y ReDoS); la versión parchada de SheetJS
  solo se distribuye fuera de npm. Como acá se parsean archivos bajados del
  banco, no vale la pena el riesgo.
- `uuid` está fijado por `overrides` porque exceljs depende de una versión con
  un aviso moderado.

## Pendiente

- El PRD (`PRD-Rumbo-Finanzas-Personales.md`) no está en la carpeta. Las
  categorías y los tokens de diseño salieron del prototipo HTML, pero las 8
  reglas de notificación son una inferencia (ver arriba).
- Fase 6: la app Flutter. La API REST ya está lista para que la consuma tal
  cual, y `DispositivoPush.plataforma` distingue WEB de ANDROID/IOS para
  reutilizar la misma tabla con FCM.
