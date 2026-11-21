# Plan aprobado: validar el porcentaje de descuento

- **Objetivo:** `aplicarDescuento` lanza un `RangeError` si el porcentaje es menor que 0 o mayor que 100.
- **Ficheros afectados:** `src/descuento.mjs` y `test/descuento.test.mjs`. Ningún otro.
- **Pruebas:** dos casos nuevos en `test/descuento.test.mjs` (−5 y 120 lanzan `RangeError`).
- **Estimación:** S.
