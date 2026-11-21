---
name: pruebas
description: Cómo escribir y ejecutar pruebas en los proyectos de Enjambre - pirámide para la lógica (node:test, cargo test), trofeo con Playwright para la web, una prueba por criterio de aceptación y sin datos reales. Úsala al implementar, revisar o verificar una historia.
---

# Pruebas en Enjambre

Estrategia (anexo B §5.7 del plan):
- **Lógica y backend: pirámide.** Muchas pruebas unitarias rápidas (`node:test` en JS, `cargo test` en Rust), pocas de integración.
- **Web: trofeo.** El valor está en los flujos: más pruebas de integración y de extremo a extremo con Playwright que unitarias de UI.

## Antes de escribir

1. Busca cómo prueba ya el proyecto: `package.json` (`scripts`), `CLAUDE.md`, carpetas `tests/`, `pruebas/`, `herramientas/prueba*`. **Usa su herramienta y su estilo**; no añadas un framework nuevo sin que el plan lo diga.
2. Lanza las pruebas existentes **antes** de cambiar nada, para saber de qué estado partes.

## Qué probar

- **Una prueba (al menos) por criterio de aceptación.** El nombre de la prueba dice qué criterio cubre.
- El caso feliz, un caso de error y un caso límite (vacío, máximo, caracteres raros, fechas).
- Si arreglas un fallo: primero una prueba que lo reproduzca y falle, después el arreglo.
- Comportamiento observable, no detalles internos. Si cambiar el nombre de una función privada rompe la prueba, la prueba está mal.

## Cómo escribirlas

```js
// node:test, sin dependencias
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEtiquetas } from '../src/etiquetas.js';

test('criterio 2: las etiquetas se guardan sin duplicados y en minúsculas', () => {
  assert.deepEqual(normalizarEtiquetas('Lobby, prueba, lobby'), ['lobby', 'prueba']);
});
```

- Datos de prueba creados por la propia prueba y borrados al terminar (patrón de `herramientas/prueba.mjs` en lobby).
- **Nunca datos reales** ni la base remota. Solo base local (`wrangler dev`, `--local`) o datos sintéticos.
- Sin esperas fijas largas cuando se puede esperar a un selector o a una respuesta.
- Deterministas: sin depender de la hora actual, del orden de red o de datos previos sin fijarlos.

## Ejecutarlas

| Proyecto | Comandos habituales |
|---|---|
| lobby | `npm run check` · `npm run dev` + `node herramientas/prueba.mjs` (E2E contra local) |
| enjambre | `npm test` |
| Rust | `cargo test` |

Informa siempre del resultado exacto (`60/60 correctas`, `3 fallos: …`), nunca «las pruebas pasan» sin la cifra.

## Al revisar pruebas (revisor)

- ¿Cada criterio tiene su prueba?
- ¿La prueba fallaría si se quitara el cambio?
- ¿Hay pruebas que solo comprueban que «no lanza excepción»?
- ¿Se ha desactivado, saltado (`skip`, `only`) o relajado alguna prueba existente? Eso es un hallazgo alto salvo justificación en el plan.
