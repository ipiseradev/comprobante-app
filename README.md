# Comprobante App

Sistema para **verificar comprobantes de pago argentinos** (transferencias bancarias, Mercado Pago y billeteras virtuales). El usuario sube una imagen del comprobante, el sistema extrae sus datos (monto, fecha, número de operación, ordenante, destinatario, CBU/CVU y banco), permite corregirlos y ejecuta validaciones para detectar inconsistencias.

> **Estado:** MVP en desarrollo. La carga de comprobantes y el modelo de datos están implementados; la extracción OCR está en etapa de evaluación de proveedores (ver [OCR Benchmark](#ocr-benchmark)).

## Stack

| Capa | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router + Route Handlers) |
| Lenguaje | TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| Base de datos | PostgreSQL 16 (Docker) |
| ORM | [Prisma 7](https://www.prisma.io) con driver adapter `@prisma/adapter-pg` |
| Almacenamiento | Supabase Storage (bucket privado) |
| Extracción (IA) | Google Gemini (`@google/genai`), intercambiable por configuración |
| Validación | Zod (variables de entorno, respuestas del extractor) |
| Tests | Vitest |

## Flujo de procesamiento

```
Usuario sube imagen
        │
        ▼
POST /api/receipts ──► Supabase Storage (bucket privado "receipts")
        │
        ▼
Receipt  [UPLOADED]
        │
        ▼
POST /api/receipts/:id/process
        │
        ▼
Receipt  [PROCESSING] ──► OCR ──► Parser / Normalizer ──► OcrData
        │                                                    │
        │                       confianza baja ◄─────────────┤
        ▼                              │                     │
   [ERROR]                         [REVIEW] ──► Correction   │
                                       │                     │
                                       ▼                     ▼
                                  Validation ◄──────── [COMPLETED]
```

| Estado | Significado |
|---|---|
| `UPLOADED` | Imagen guardada en Storage, pendiente de procesar |
| `PROCESSING` | Extracción de datos en curso |
| `REVIEW` | Datos extraídos con baja confianza: requieren revisión del usuario |
| `COMPLETED` | Datos extraídos y validados |
| `ERROR` | Falló el procesamiento (el motivo queda en `lastError`) |

Transiciones permitidas (definidas en [`lib/receipt-status.ts`](lib/receipt-status.ts)):

| Desde | Hacia |
|---|---|
| `UPLOADED` | `PROCESSING` |
| `PROCESSING` | `COMPLETED`, `REVIEW`, `ERROR` |
| `ERROR` | `PROCESSING` (reintento) |
| `COMPLETED`, `REVIEW` | — (finales; el reprocesamiento requerirá una acción explícita) |

Cada vez que un procesamiento comienza se incrementa `processingAttempts`.

## Modelo de datos

| Modelo | Descripción |
|---|---|
| `User` | Usuario dueño de los comprobantes |
| `Receipt` | Comprobante subido: path de la imagen en Storage, estado, intentos de procesamiento, último error y hash de la imagen |
| `OcrData` | Datos extraídos: monto, fecha, número de operación, emisor del comprobante, nombre + CBU/CVU + banco **de origen y de destino por separado**, texto crudo y confianza, más trazabilidad de la extracción (proveedor, modelo, respuesta cruda y checks por campo) |
| `Correction` | Correcciones manuales del usuario sobre un campo extraído (valor original → corregido) |
| `Validation` | Resultado de las validaciones: `CONSISTENT`, `REVIEW` o `INCONSISTENT`, con `riskScore` y detalle de los checks |

El schema completo está en [`prisma/schema.prisma`](prisma/schema.prisma).

## Motor de validación

Cada regla es una función pura e independiente en [`lib/validation/rules/`](lib/validation/rules), con su peso y una explicación en lenguaje simple para el usuario.

| Regla | Peso | Qué verifica |
|---|---|---|
| CBU/CVU matemáticamente válido | 60 | 22 dígitos y los dos dígitos verificadores, de origen y de destino |
| CBU/CVU coherente con el banco | 50 | El prefijo de cada CBU/CVU coincide con el banco **de su titular** (un CVU no puede ser de un banco tradicional; un CVU de Mercado Pago empieza con `0000003`) |
| Comprobante no repetido | 70 | El mismo número de operación no fue verificado antes **por el mismo usuario** |
| Monto válido | 50 | Positivo y con como máximo dos decimales |
| Fecha válida y reciente | 30 | Existe en el calendario, no es futura; advertencia después de 7 días y falla después de 90 (posible comprobante reutilizado) |
| Datos esenciales | 20 | Monto, fecha, número de operación y destinatario |
| Formato del monto ⚠️ | 30 | Formato argentino (`45.990,50`) en el texto del comprobante |
| Formato del número de operación ⚠️ | 10 | Formato habitual del emisor |

⚠️ = regla de baja confianza: nunca pasa de advertencia.

**Score de riesgo (0–100):** cada regla que falla suma su peso; cada advertencia, la mitad. Las reglas que no se pueden verificar por falta de datos no suman.

| Veredicto | Condición |
|---|---|
| Sin inconsistencias detectadas | Score menor a 20 y ninguna regla fallida |
| Sospechoso | Score de 20 a 49, o cualquier regla fallida |
| Probablemente falso | Score de 50 o más |

Todos los veredictos, incluido el mejor, muestran **"Confirmá el ingreso en tu cuenta antes de entregar"**: ninguna regla sobre la imagen prueba que el dinero llegó, y una falsificación hecha editando un comprobante real puede pasar todas las reglas.

Los códigos de entidad del BCRA en [`lib/validation/entities.ts`](lib/validation/entities.ts) incluyen solo los confirmados en más de una fuente: un código desconocido deja la regla como "no verificable", mientras que uno equivocado generaría falsos positivos.

## Requisitos

- Node.js 20+
- Docker y Docker Compose
- Un proyecto de [Supabase](https://supabase.com) con un bucket de Storage **privado** llamado `receipts`

## Instalación

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/ipiseradev/comprobante-app.git
cd comprobante-app
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Completar SUPABASE_URL y SUPABASE_SECRET_KEY

# 3. Levantar PostgreSQL
docker compose up -d

# 4. Aplicar migraciones y generar el cliente de Prisma
npx prisma migrate dev

# 5. Iniciar el servidor de desarrollo
npm run dev
```

La app queda disponible en [http://localhost:3000](http://localhost:3000).

> **Puerto 5434:** el contenedor de PostgreSQL se expone en `localhost:5434` (no en el 5432 por defecto) para no chocar con una instalación local de PostgreSQL.

### Bucket de Supabase

Crear en Supabase Storage un bucket con:

- **Nombre:** `receipts` (exacto)
- **Acceso:** privado
- **Tamaño máximo:** 10 MB
- **Tipos permitidos:** `image/jpeg`, `image/png`, `image/webp`

Las imágenes se guardan como `<userId>/<uuid>.<ext>` y solo el servidor accede a ellas mediante la secret key.

> **`Receipt.imageUrl` guarda el path privado del objeto dentro del bucket** (ej. `<userId>/<uuid>.jpg`), **no** una URL pública ni una signed URL. Para leer la imagen hay que descargarla desde el servidor con el cliente de Supabase.

## Variables de entorno

Se validan con Zod en [`lib/env.ts`](lib/env.ts): si falta una obligatoria, la app falla con un mensaje que indica cuál. La plantilla documentada está en [`.env.example`](.env.example).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |
| `ALLOW_REAL_UPLOADS` | No | `true`/`false`. Sin definir: habilitado en desarrollo y **deshabilitado en producción** (modo demo) |
| `SUPABASE_URL` | Si hay upload real | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Si hay upload real | Secret key de Supabase. **Solo servidor**, nunca exponer al cliente |
| `EXTRACTOR` | No | `mock` (default, sin llamadas externas) o `gemini` |
| `GEMINI_API_KEY` | Si `EXTRACTOR=gemini` | API key de Google AI Studio |
| `GEMINI_MODEL` | No | Default: `gemini-3.8-flash` |
| `LOG_LEVEL` | No | `debug`, `info` (default), `warn` o `error` |

> ⚠️ Con una API key de Gemini del **free tier**, Google puede usar el contenido enviado para mejorar sus productos. No la uses con comprobantes reales.

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/receipts` | Sube un comprobante (`multipart/form-data`, campo `file`; JPG, PNG o WEBP hasta 10 MB) y crea el `Receipt` en estado `UPLOADED` |
| `POST` | `/api/receipts/:id/process` | Inicia el procesamiento de forma atómica (`UPLOADED`/`ERROR` → `PROCESSING`) e incrementa `processingAttempts`. Responde `409` si el comprobante ya está en proceso o ya fue procesado, `404` si no existe y `400` si el ID es inválido |

`POST /api/receipts` responde `403` cuando `ALLOW_REAL_UPLOADS` es `false`.

Todas las respuestas de error tienen la forma `{ "success": false, "error": "<mensaje para el usuario>", "code": "<CÓDIGO>" }`. Los detalles internos nunca llegan al cliente: quedan en los logs, que se escriben en JSON (una línea por evento, con un `requestId` por request).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:gemini` | Benchmark de Gemini contra `ocr-benchmark/` (hace llamadas reales a la API) |
| `npx prisma migrate dev` | Aplica migraciones en desarrollo |
| `npx prisma studio` | Explorador visual de la base de datos |

## Estructura del proyecto

```
comprobante-app/
├── app/
│   ├── api/
│   │   ├── receipts/
│   │   │   ├── route.ts               # Subida de comprobantes
│   │   │   └── [id]/process/route.ts  # Inicio del procesamiento
│   ├── layout.tsx
│   └── page.tsx                       # UI de carga (drag & drop + preview)
├── lib/
│   ├── env.ts                         # Variables de entorno validadas con Zod
│   ├── errors.ts                      # Errores tipados y respuestas HTTP seguras
│   ├── logger.ts                      # Logs estructurados (JSON)
│   ├── ocr/                           # Extracción: contrato, Gemini, mock y factory
│   ├── prisma.ts                      # Cliente de Prisma (singleton + adapter pg)
│   ├── receipt-status.ts              # Ciclo de vida y transiciones de estado
│   ├── supabase.ts                    # Cliente de Supabase (solo servidor)
│   └── validation/                    # Motor de reglas, score y veredicto
├── scripts/
│   └── test-gemini.ts                 # Benchmark de extracción
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── ocr-benchmark/                     # Evaluación de proveedores de OCR
├── docker-compose.yml                 # PostgreSQL 16
└── prisma.config.ts
```

## OCR Benchmark

Antes de integrar un proveedor de OCR, se evalúan las alternativas contra un ground truth cargado manualmente, midiendo la precisión campo por campo (monto, fecha, número de operación, nombres, CBU/CVU y banco) sobre comprobantes reales: capturas de pantalla, fotos con celular e imágenes de baja calidad.

Las imágenes y el ground truth contienen datos personales y **no se versionan**. El formato y las reglas están documentados en [`ocr-benchmark/README.md`](ocr-benchmark/README.md).

## Roadmap

- [x] Carga de comprobantes con validación de tipo y tamaño
- [x] Almacenamiento en bucket privado de Supabase
- [x] Modelo de datos (Receipt, OcrData, Correction, Validation)
- [x] Ground truth inicial del benchmark de OCR
- [ ] Benchmark de proveedores de OCR / extracción estructurada
- [ ] Integración del proveedor elegido + parser y normalizador
- [ ] Revisión y corrección de datos por parte del usuario
- [ ] Validaciones: dígitos verificadores de CBU/CVU, consistencia de montos y fechas, comprobantes duplicados
- [ ] Autenticación de usuarios
