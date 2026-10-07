# OCR Benchmark

Conjunto de evaluación para comparar proveedores de OCR / extracción estructurada sobre comprobantes de pago argentinos, antes de elegir el proveedor de producción.

> **Privacidad:** las imágenes y el ground truth contienen datos personales reales (nombres, CUIT/CUIL, CBU/CVU). Por eso `images/` y `expected/` están en `.gitignore` y **nunca se versionan**. Cada desarrollador mantiene su propio set de forma local.

## Estructura

```
ocr-benchmark/
├── images/      # Comprobantes: 001.jpg, 002.jpg, ... (local, no versionado)
└── expected/    # Ground truth manual: 001.json, 002.json, ... (local, no versionado)
```

Cada imagen `NNN.jpg` tiene su ground truth en `expected/NNN.json`.

## Formato del ground truth

```json
{
  "amount": 45990.5,
  "date": "2026-07-09",
  "operationNumber": "167191758841",
  "issuer": "Billetera Andina",
  "sender": {
    "name": "Nombre Apellido",
    "cbuCvu": "0000000000000000000000",
    "bank": "Billetera Andina"
  },
  "receiver": {
    "name": "Nombre Apellido",
    "cbuCvu": "0000000000000000000000",
    "bank": null
  },
  "sourceType": "screenshot",
  "quality": "good"
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `amount` | número o `null` | Sin `$` ni separadores argentinos: `"$ 45.990,50"` → `45990.5` |
| `date` | `"YYYY-MM-DD"` o `null` | Fecha de la operación |
| `operationNumber` | texto o `null` | Exactamente como aparece (sin espacios visuales) |
| `issuer` | texto o `null` | Banco o billetera que **emitió** el comprobante (logo o encabezado) |
| `sender.name` / `receiver.name` | texto o `null` | Titular que envía / recibe, tal como aparece |
| `sender.cbuCvu` / `receiver.cbuCvu` | texto o `null` | Solo dígitos (22). No confundir con número de cuenta, tarjeta o alias |
| `sender.bank` / `receiver.bank` | texto o `null` | Banco de ese titular, **solo si aparece explícitamente junto a sus datos**. No se copia el `issuer` |
| `sourceType` | `screenshot`, `photo` o `downloaded` | Origen de la imagen |
| `quality` | `good`, `medium` o `poor` | Legibilidad de la imagen |

El extractor también devuelve `rawText` (transcripción del texto visible), que no se compara porque no tiene una única versión correcta.

## Cómo correr el benchmark

```bash
npm run test:gemini        # las 4 imágenes
npm run test:gemini 002    # una sola
```

> ⚠️ Hace llamadas reales a Gemini. Con una API key del **free tier**, Google puede usar las imágenes enviadas para mejorar sus productos: no lo corras con comprobantes reales sin facturación activa.

## Cómo armar el ground truth

1. El ground truth se carga **leyendo cada comprobante a mano**, nunca con un OCR (si no, el benchmark mide al OCR contra sí mismo).
2. Si un campo no aparece en el comprobante → `null`. No inferir ni completar datos.
3. Validar cada CBU/CVU con sus dígitos verificadores antes de aprobarlo.
4. Cubrir variedad: bancos y billeteras distintas, capturas, fotos con celular, imágenes borrosas o con mala iluminación, y casos que no son transferencias.
