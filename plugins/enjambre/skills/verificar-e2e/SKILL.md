---
name: verificar-e2e
description: Cómo verificar de extremo a extremo una historia de Enjambre - levantar el servidor local, recorrer cada criterio de aceptación con las pruebas del proyecto o con Playwright, guardar evidencias y escribir el informe PASA/FALLA. Úsala al hacer QA de un PR; nunca contra producción.
---

# Verificar de extremo a extremo

El verificador comprueba cada criterio **ejecutando** la aplicación en local. Sin evidencia no hay PASA.

## 1. Preparar

1. Ponte en la rama del PR: `gh pr checkout <n>`. Anota el commit: `git rev-parse --short HEAD`.
2. Instala dependencias solo si cambiaron: `npm ci`.
3. Lanza las comprobaciones rápidas del proyecto (en lobby: `npm run check`).

## 2. Levantar el servidor local

- Lánzalo **en segundo plano** y espera a que responda antes de probar.
- En lobby: `npm run dev` (Worker en `http://127.0.0.1:8787` contra la base D1 local).
  ```bash
  npm run dev > /tmp/servidor.log 2>&1 &
  for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8787 && break; sleep 1; done
  ```
- Solo local. **Nunca** `--remote`, nunca la URL de producción, nunca datos reales.
- Al terminar, para el servidor (mata el proceso que lanzaste) aunque la verificación falle.

## 3. Recorrer los criterios

Por orden de preferencia:

1. **La prueba E2E del proyecto.** En lobby, `node herramientas/prueba.mjs`: recorre los flujos con Playwright contra local, crea datos de prueba y los borra. Informa `N/M correctas`. Ese script lee por su cuenta `.dev.vars` y `datos/.clave-local`; tú no abres esos ficheros.
2. **Una comprobación de API** con `curl` o `fetch` contra local, cuando el criterio es de datos.
3. **Navegador con Playwright** para criterios de interfaz que la prueba del proyecto no cubre:
   - con `playwright-cli` si está instalado (`playwright-cli open http://127.0.0.1:8787`, `snapshot`, `click`, `fill`, `screenshot --filename=...`);
   - o con un script corto de `playwright-core` (`chromium.launch({ channel: 'chrome' })`), igual que `prueba.mjs`.
   - Escucha `pageerror` y respuestas HTTP ≥ 400: cualquier error en la página es un hallazgo.
   - Comprueba también a 390 px de ancho si el criterio es visual (sin scroll horizontal).

Para cada criterio anota: qué ejecutaste, qué esperabas, qué pasó.

## 4. Evidencias

| Tipo | Cómo |
|---|---|
| Salida de pruebas | extracto con el recuento y las líneas de fallo |
| Captura | fichero PNG con nombre `qa-<pr>-c<criterio>.png`, fuera del repo o en la carpeta que diga el proyecto |
| API | método, ruta y extracto de la respuesta (sin tokens ni datos personales) |
| Consola | errores de `pageerror` y respuestas ≥ 400 |

Nunca incluyas secretos, cabeceras `Authorization` ni datos reales en las evidencias.

## 5. Informe

Rellena `plantilla-informe-qa.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-informe-qa.md`).

- Un resultado por criterio: **PASA**, **FALLA** o **NO VERIFICADO** con el motivo.
- Veredicto global **PASA** solo si todos los criterios pasan con evidencia.
- Para cada fallo: pasos para reproducir, esperado y obtenido.
- Propón pruebas de regresión que falten. Solo las escribes si el plan lo pide, en `tests/` o `herramientas/prueba*`.

## Si algo impide verificar

Servidor que no arranca, dependencia que falta, criterio ambiguo: **no lo des por bueno**. Márcalo NO VERIFICADO, explica el motivo y para.
