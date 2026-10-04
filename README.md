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
| `ERROR` | Falló el procesamiento |

## Modelo de datos

| Modelo | Descripción |
|---|---|
| `User` | Usuario dueño de los comprobantes |
| `Receipt` | Comprobante subido: ruta de la imagen en Storage y estado del procesamiento |
| `OcrData` | Datos extraídos: monto, fecha, número de operación, ordenante, destinatario, CBU/CVU, banco, texto crudo y confianza |
| `Correction` | Correcciones manuales del usuario sobre un campo extraído (valor original → corregido) |
| `Validation` | Resultado de las validaciones: `CONSISTENT`, `REVIEW` o `INCONSISTENT`, con `riskScore` y detalle de los checks |

El schema completo está en [`prisma/schema.prisma`](prisma/schema.prisma).

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

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Secret key de Supabase. **Solo servidor**, nunca exponer al cliente |

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/receipts` | Sube un comprobante (`multipart/form-data`, campo `file`; JPG, PNG o WEBP hasta 10 MB) y crea el `Receipt` en estado `UPLOADED` |
| `POST` | `/api/receipts/:id/process` | Inicia el procesamiento del comprobante (`UPLOADED` → `PROCESSING`) |
| `GET` | `/api/test-db` | Endpoint de diagnóstico para desarrollo: crea un usuario de prueba y lista los últimos 5 |

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
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
│   │   └── test-db/route.ts           # Diagnóstico de la base (dev)
│   ├── layout.tsx
│   └── page.tsx                       # UI de carga (drag & drop + preview)
├── lib/
│   ├── prisma.ts                      # Cliente de Prisma (singleton + adapter pg)
│   └── supabase.ts                    # Cliente de Supabase (solo servidor)
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
