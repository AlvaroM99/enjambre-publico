# 0006. Repositorio público, analista, gobernanza y coordinador

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

1. GitHub Actions de un proyecto no puede instalar el plugin desde un repositorio privado (reto R5). Álvaro elige **un repositorio público clonado del privado**.
2. Pide dos agentes nuevos:
   - un **organizador** que haga gobernanza de código y datos;
   - un **investigador previo** que analice la petición y el estado del arte (estándar, bibliotecas, repositorios públicos, competencia) para no construir desde cero lo que ya existe.
3. Pide revisar el organigrama, las relaciones, el arnés, los plugins y una visualización de los agentes «como en una oficina».

## Decisión

### 1. `AlvaroM99/enjambre-publico`

- **Público, sin el historial del privado.** Todos los commits privados llevan el correo personal de Álvaro como autor; publicar ese historial lo expondría. El público recibe **instantáneas** con `node herramientas/publicar.mjs`:
  - copia los ficheros exactos de `HEAD` del privado;
  - se niega a publicar si encuentra correos personales, tokens o claves privadas;
  - firma el commit con la dirección noreply de GitHub.
- **Fuente de verdad: el privado.** El público no se edita a mano. Solo Álvaro ejecuta el script (los agentes no pueden hacer push a `main`).
- Las plantillas (`settings.proyecto.json` y workflows) instalan el plugin desde el público.
- En el público, Actions no tiene límite de minutos y la CI del repo corre gratis [POR CONFIRMAR cifras en la documentación de facturación de GitHub].
- **Qué queda visible:** todo el contenido actual, incluido el anexo A (inventario del entorno de Álvaro, nombres de repos privados y alcance de su token de `gh`). No hay secretos ni datos personales; Álvaro puede pedir que se resuma ese anexo en la versión pública.

### 2. Tres agentes nuevos (de 7 a 10)

| Agente | Rol | Escribe | Web | Modelo |
|---|---|---|---|---|
| `enjambre-analista` | investigador previo: petición, estándar, bibliotecas, repositorios, competencia; recomienda reutilizar, partir de, integrar o construir | no | **sí** (único) | sonnet |
| `enjambre-gobernanza` | organizador: estructura, documentación, ADR, código, dependencias, agentes y CI, datos y trazabilidad, con nota de 0 a 3 por área | no | no | sonnet |
| `enjambre-coordinador` | sesión principal (`claude --agent enjambre:enjambre-coordinador`): hace cumplir el flujo, lanza a los demás, lleva el tablero; no planifica ni escribe | no | no | sonnet |

- **Regla de dos para el analista:** lee contenido no confiable (la web) y puede comentar issues, pero no escribe código y no puede leer secretos (hooks). Su informe es un dato para el jefe, no una orden.
- **El coordinador solo puede lanzar agentes de Enjambre** (`Agent(...)` en `tools`, que se aplica cuando el agente es la sesión principal con `--agent`; fuente: https://code.claude.com/docs/en/sub-agents). El nombre con espacio de nombres del plugin está [POR CONFIRMAR] en la prueba de humo.
- Skills nuevas: `investigar-estado-del-arte` (con plantilla de investigación) y `gobernanza` (con plantilla de informe).
- Workflows nuevos en la skill `ci-cd`: `enjambre-analizar.yml` (etiqueta `enjambre:analizar`) y `enjambre-gobernanza.yml` (manual).

### 3. Observabilidad y visualización

- Hook `registrar-actividad` en `SubagentStart` y `SubagentStop`: anota inicio y fin de cada agente de Enjambre en `actividad.jsonl` (sin contenido de la conversación). Nunca bloquea.
- **Pixel Agents** (https://github.com/pixel-agents-hq/pixel-agents, MIT) para ver a los agentes en una oficina de píxeles. No es un plugin de Claude Code sino una extensión de VS Code o un servidor local (`npx pixel-agents`) que lee las sesiones de Claude Code. **Lo instala Álvaro** (código de terceros); los pasos están en `docs/operacion.md`.

### 4. Plugins oficiales en la plantilla de proyecto

`context7` y `playwright` del marketplace oficial `anthropics/claude-plugins-official`, activados en `plantillas/settings.proyecto.json`. `github`, `security-guidance`, `plugin-dev` y `skill-creator` quedan documentados como opcionales en el [organigrama](../organigrama.md).

## Consecuencias

- El organigrama completo, las relaciones, el RACI y el arnés por agente están en [`docs/organigrama.md`](../organigrama.md).
- `npm test` comprueba los 10 agentes, que solo el analista tiene web, que el coordinador solo lanza agentes de Enjambre, las listas blancas nuevas, el hook de actividad y el filtro del script de publicación.
- Hay que publicar después de cada cambio que deban ver los proyectos: `node herramientas/publicar.mjs`.
