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
  "senderName": "Nombre Apellido",
  "receiverName": "Nombre Apellido",
  "cbuCvu": "0000000000000000000000",
  "bank": "Mercado Pago",
  "sourceType": "screenshot",
  "quality": "good"
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `amount` | `number \| null` | Sin `$` ni separadores argentinos: `"$ 45.990,50"` → `45990.5` |
| `date` | `"YYYY-MM-DD" \| null` | Fecha de la operación |
| `operationNumber` | `string \| null` | Exactamente como aparece (sin espacios visuales) |
| `senderName` | `string \| null` | Persona/cuenta que envía el dinero |
| `receiverName` | `string \| null` | Persona/cuenta que recibe el dinero |
| `cbuCvu` | `string \| null` | Solo dígitos (22). CBU/CVU del destinatario. No confundir con número de cuenta, tarjeta o alias |
| `bank` | `string \| null` | Banco o billetera identificable en el comprobante |
| `sourceType` | `"screenshot" \| "photo" \| "downloaded"` | Origen de la imagen |
| `quality` | `"good" \| "medium" \| "poor"` | Legibilidad de la imagen |

## Cómo armar el ground truth

1. El ground truth se carga **leyendo cada comprobante a mano**, nunca con un OCR (si no, el benchmark mide al OCR contra sí mismo).
2. Si un campo no aparece en el comprobante → `null`. No inferir ni completar datos.
3. Validar cada CBU/CVU con sus dígitos verificadores antes de aprobarlo.
4. Cubrir variedad: bancos y billeteras distintas, capturas, fotos con celular, imágenes borrosas o con mala iluminación, y casos que no son transferencias.
