# Issue #7: filtrar la lista de productos por etiqueta

La lista de productos sale de `listarProductos()` en `src/productos.mjs`. Quiero que cada producto pueda tener etiquetas (por ejemplo «oferta») y poder ver solo los productos que tengan una etiqueta concreta. Hoy no hay etiquetas.

Criterios de Álvaro:
- Las etiquetas van en el propio catálogo, como lista `etiquetas` en cada producto. Taza y Libreta llevan «oferta»; Camiseta, ninguna.
- `listarProductos(etiqueta)`: sin etiqueta devuelve todos; con etiqueta, solo los que la tienen. No distingue mayúsculas.
- Sin interfaz nueva ni dependencias. Con pruebas en `test/`.
