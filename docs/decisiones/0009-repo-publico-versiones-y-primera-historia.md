# 0009. Papel del repo público, plugin versionado, M11 y primera historia

- **Fecha:** 22-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

El 22-11-2026, Álvaro:
- fusiona lobby#1, finance_tracker#1 y finance_tracker#2;
- crea el secreto `CLAUDE_CODE_OAUTH_TOKEN` en `AlvaroM99/enjambre`;
- pide lanzar la primera historia en lobby, aplicar la mejora M11 y ejecutar las evaluaciones.

También pregunta si el repo público necesita el secreto y qué papel tiene.

## Decisión

### 1. Papel del repo público

`AlvaroM99/enjambre-publico` es el **canal de distribución** del plugin, no un espejo vivo del privado:

| | Privado `enjambre` | Público `enjambre-publico` |
|---|---|---|
| Qué es | Fuente de verdad: historial, issues, ADR | Instantánea sin historial de cada versión publicada |
| Quién escribe | Álvaro y sus sesiones | Solo `herramientas/publicar.mjs`, que lanza Álvaro |
| Para qué sirve | Desarrollar y probar Enjambre | Marketplace del que instalan los proyectos y la Action, y escaparate |
| Secreto `CLAUDE_CODE_OAUTH_TOKEN` | Sí, para `evals.yml` | **No**: no ejecuta agentes |
| Versiones | Commits | Etiquetas `vX.Y.Z` (las crea `publicar.mjs`) |

El público no lleva el secreto porque solo pasa su CI de pruebas. Un secreto que no se usa es superficie de ataque sin beneficio. GitHub no entrega secretos a los PR de forks, pero ni siquiera hace falta esa protección. La sincronización sigue siendo manual. Automatizarla exigiría otro token con escritura en el público, guardado en el privado, y no compensa.

### 2. Plugin versionado por SHA (M11, segunda mitad)

`plugin_marketplaces` de `claude-code-action` solo acepta URLs `.git` o rutas locales, sin `#ref` ([install-plugins.ts](https://github.com/anthropics/claude-code-action/blob/acfe7992852970efb4fee683d63d628e3e52df67/base-action/src/install-plugins.ts)). Cada job de agente hace ahora tres cosas:
1. comprueba que `vars.ENJAMBRE_VERSION` es un SHA de 40 caracteres y, si no, se para (falla cerrado);
2. hace checkout de `enjambre-publico` en ese SHA y lo mueve a `$RUNNER_TEMP`, fuera del espacio de trabajo del agente;
3. instala el plugin desde esa ruta.

La primera versión usaba una etiqueta. Las revisiones de Enjambre sobre lobby#3 señalaron que las etiquetas se pueden mover (OpenSSF Pinned-Dependencies), y por eso se pasó a SHA.

`publicar.mjs` crea la etiqueta `v<versión de plugin.json>` e imprime el SHA y la orden `gh variable set ENJAMBRE_VERSION`. Plugin en la versión **0.3.0**. `ENJAMBRE_VERSION` está creada en lobby y finance_tracker con el SHA de `v0.3.0`.

**Uso local:** `.claude/settings.json` sigue instalando desde la rama por defecto del repo público. Que el marketplace de GitHub admita fijar `ref` está [POR CONFIRMAR].

### 3. Hook `bloquear-comandos`: escrituras por la API (M11, primera mitad)

La regla `gh-api-borrado` (DELETE, PUT y PATCH) pasa a `gh-api-escritura`, que bloquea:
- cualquier método distinto de GET;
- los campos `-f`, `-F`, `--field`, `--raw-field` e `--input`, que implican POST salvo con `-X GET`;
- el endpoint `/merges`;
- las mutaciones de GraphQL.

Las lecturas siguen permitidas: `gh api <ruta>`, `-X GET` con parámetros y consultas GraphQL. Hay 11 pruebas nuevas, 7 de comandos bloqueados y 4 de permitidos.

### 4. Primera historia por eventos (criterio de salida de F2)

- Issue [lobby#2](https://github.com/AlvaroM99/lobby/issues/2): `npm test` con pruebas unitarias de las utilidades puras de `public/js/ui.js`. Sale del hallazgo 1 de la primera revisión real.
- Etiqueta `enjambre:planificar` → el jefe de proyecto (Opus) publicó el plan en 14 turnos (0,76 USD estimados).
- El plan incluye:
  - ficheros con `fichero:línea` y decisiones de diseño (zona horaria fija para las fechas, ruta explícita para Node 18);
  - pruebas por función y 8 criterios Dado/Cuando/Entonces;
  - riesgos y un aviso fuera de alcance (`aCSV` no entrecomilla `\r` suelto).
- **Puerta 1:** aprobar el plan es de Álvaro. Con su aprobación se pone `enjambre:implementar`, el implementador abre el PR, y `enjambre:revisar` cierra el ciclo.

### 5. Primera ejecución del banco de evaluaciones (criterio de F3)

`gh workflow run evals.yml`, CLI 2.1.330, en GitHub Actions:

| Resultado | Valor |
|---|---|
| pass@1 | **100 % (20/20)**; los 10 agentes pasan todas sus tareas |
| Coste estimado | 1,23 USD en total (de 0,01 a 0,28 USD por tarea) |
| Duración | Unos 8 minutos de runner |
| Respuestas revisadas a mano | El coordinador se para en la puerta 1 y dice que una notificación no es una aprobación. Seguridad bloquea la inyección SQL con OWASP A03. El revisor no escribe y da el veredicto en texto |

Es el **pass@1 de referencia**: ninguna tarea que pasa puede dejar de pasar tras cambiar un prompt, un hook o un modelo. Un 100 % a la primera también indica que el banco se queda corto para distinguir mejoras. **Mejora M12:** añadir tareas más difíciles y ambiguas, sacadas de las historias reales de lobby y finance_tracker.

### 6. Respaldo cuando un revisor no comenta

En 4 ejecuciones reales, el agente de seguridad terminó 2 veces sin publicar comentario, sin error y en pocos turnos. La Action no guarda la transcripción en los logs, así que la causa queda [POR CONFIRMAR]. El job `revisar` ahora:
1. anota la hora de inicio;
2. al terminar el agente, busca un comentario con su título publicado después de esa hora;
3. si no existe, publica la respuesta final del agente, sacada del `execution_file` de la Action, con la nota «Publicado por el workflow».

<!-- RESPALDO -->

## Consecuencias

- Para subir de versión Enjambre en un proyecto hace falta un paso consciente: publicar, copiar el SHA y cambiar una variable. Un cambio en `main` del público no llega solo a los agentes.
- Los PR [lobby#3](https://github.com/AlvaroM99/lobby/pull/3) y [finance_tracker#3](https://github.com/AlvaroM99/finance_tracker/pull/3) llevan la fijación por SHA a los proyectos. Hasta que Álvaro los fusione, `main` sigue instalando desde la URL.
