# Modelos de reconocimiento facial (locales)

Estos archivos los usa `@vladmandic/face-api` desde `frontend/src/lib/reconocimientoFacial.js`. Se sirven desde el propio sistema (`/models`), así que **no se necesita internet**.

- **Origen**: carpeta `model/` del paquete `@vladmandic/face-api` **1.7.15** (npm).
- **Licencia**: MIT, © Vladimir Mandic (ver el archivo `LICENSE` del paquete).
- **Uso**: solo para identificar a clientes ya registrados en el punto de acceso. No se infieren edad, género ni expresiones, por eso esos modelos NO se incluyen.

| Archivo | Para qué sirve | Tamaño (bytes) | SHA-256 |
|---|---|---|---|
| `tiny_face_detector_model.bin` | Detecta el rostro en cada fotograma | 193 321 | `b7503ce7df31039b1c43316a9b865cab6a70dd748cc602d3fa28b551503c3871` |
| `tiny_face_detector_model-weights_manifest.json` | Índice de pesos del detector | 3 219 | `5d1af4849ac48d5b985f4a9b16010c512353ddd6fcc63d50fd0bc9e9e64296e5` |
| `face_landmark_68_model.bin` | Puntos del rostro para alinearlo | 356 840 | `4611ef65c87d836d03d684b30eec4d195d8b219fa1dd58fc58945831c6b9299b` |
| `face_landmark_68_model-weights_manifest.json` | Índice de pesos de los puntos | 8 485 | `ca4886639f86e99b39fed0c155f81b63317225773bd9616716e887b0153389c9` |
| `face_recognition_model.bin` | Genera el descriptor de 128 valores | 6 444 032 | `b413e420d6840b2775fba32008db6f3cddb07d485967fb42cfcf379c16a8c589` |
| `face_recognition_model-weights_manifest.json` | Índice de pesos del reconocimiento | 19 615 | `cbaffa501b0b9275a12b63357a6843e7e30c054e1c9151e1a5f879b26e32986b` |

Total aproximado: 7 MB. Los modelos se cargan una sola vez al abrir la Estación de acceso o el registro de rostro, y el navegador los guarda en caché.

## Cómo verificar que no cambiaron

```text
cd frontend/public/models
sha256sum *.bin *.json     # los valores deben coincidir con la tabla
```

## Importante

- Si se cambia de versión de la biblioteca o de modelos, los descriptores ya guardados dejan de ser comparables: los rostros deben registrarse de nuevo.
- Para restaurar estos archivos: copiarlos de `frontend/node_modules/@vladmandic/face-api/model/` (solo los tres modelos de la tabla).
