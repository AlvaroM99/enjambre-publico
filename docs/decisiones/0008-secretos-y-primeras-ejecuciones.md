# 0008. Secretos, repositorios y primeras ejecuciones reales (fases 2 y 3)

- **Fecha:** 22-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

El ADR 0007 dejó las fases 2 y 3 cerradas en todo lo que no necesitaba una sesión de Claude. Faltaba el secreto `CLAUDE_CODE_OAUTH_TOKEN`. El 22-11-2026 Álvaro lo genera con `claude setup-token` y pide:
- ponerlo en lobby, finance_tracker y el propio Enjambre;
- dejar al día secretos, tokens y repositorios;
- terminar las fases 2 y 3.

## Decisión

### Secretos y variables por repositorio

En una cuenta personal de GitHub no hay secretos compartidos entre repositorios: cada repo que ejecuta agentes necesita su propia copia. Todos usan el **mismo token**, que gasta del mismo plan Pro.

| Repositorio | `CLAUDE_CODE_OAUTH_TOKEN` | `ENJAMBRE_WIP` | Etiquetas `enjambre:*` | Para qué lo usa |
|---|---|---|---|---|
| `AlvaroM99/lobby` | Sí (22-11-2026) | 3 | Sí | Workflows de agentes ([lobby#1](https://github.com/AlvaroM99/lobby/pull/1)) |
| `AlvaroM99/finance_tracker` | Sí (22-11-2026) | 3 | Sí | Workflows de agentes ([finance_tracker#2](https://github.com/AlvaroM99/finance_tracker/pull/2)) |
| `AlvaroM99/enjambre` | Lo pone Álvaro con `gh secret set` | — | — | Workflow `evals.yml`: banco de evaluaciones en Actions |
| `AlvaroM99/enjambre-publico` | **No** | — | — | Solo sirve el plugin; no ejecuta agentes |

Sobre el token:
- **Qué es:** un token OAuth de un año de la cuenta de Claude de Álvaro. `claude setup-token` lo muestra una vez y no lo guarda en ningún sitio. Fuente: https://code.claude.com/docs/en/authentication.md.
- **Dónde se guarda:** solo en los secretos de GitHub, cifrado. GitHub no deja volver a verlo, solo sustituirlo. Álvaro guarda su copia en un gestor de contraseñas.
- **Cómo se revoca:** la CLI no tiene orden para revocarlo. Las peticiones [anthropics/claude-code#48373](https://github.com/anthropics/claude-code/issues/48373) y [#57400](https://github.com/anthropics/claude-code/issues/57400) se cerraron sin cambios. La documentación oficial no explica cómo revocarlo desde la web. [POR CONFIRMAR]
- **Incidencia:** el token pasó por una conversación con Claude. Álvaro decide usarlo igualmente y asume el riesgo. Mitigación: renovarlo antes de que caduque, o antes si se confirma una forma de revocarlo.
- **Renovación (antes del 22-11-2027):** `claude setup-token` y luego `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/<repo>` en cada repo de la tabla.

### finance_tracker con agentes

Álvaro lo pide de forma expresa, lo que cumple la regla 7 de finance_tracker. Se abre un PR aparte de la CI de Rust con:
- los seis workflows de agentes;
- `.claude/settings.json` con reglas `deny` para `tracker/.dev.vars`, `tracker/datos/`, `_origen/` y los objetivos de `make` que despliegan o tocan datos reales;
- la plantilla de PR, CODEOWNERS, la regla 9 en su CLAUDE.md y una decisión en `docs/decisiones/`.

No lleva workflow de producción.

### Evaluaciones en GitHub Actions

`.github/workflows/evals.yml` (solo manual y solo el propietario):
- instala la CLI de Claude Code en una versión fija (2.1.330);
- se autentica con el secreto;
- ejecuta `evals/ejecutar.mjs`;
- deja una tabla en el resumen del run y el JSON como artefacto durante 90 días.

El runner solo se salta las preguntas de permiso en máquinas desechables, es decir, en el devcontainer o en un runner de Actions. Así la primera medida de pass@1 no depende de que Álvaro inicie sesión en la CLI local.

### Primera ejecución real: el revisor sobre lobby#1

Resultado:
- El plugin se instaló desde `enjambre-publico`.
- El revisor (Opus) leyó los 17 ficheros del diff, agotó sus 15 turnos y publicó el veredicto **CAMBIOS** con 10 hallazgos y lo que comprobó y lo que no.
- Coste estimado por el cliente: 0,92 USD. Con suscripción no se factura, pero gasta del plan.

| Hallazgo | Resolución |
|---|---|
| El job `sensible` no podía leer el diff (HTTP 403 por falta de `contents: read`) y lo tomaba como «no sensible»: la revisión de seguridad se saltó sin avisar | Plantilla, lobby y finance_tracker: `contents: read`, y si falla, se trata como sensible (falla cerrado). Prueba nueva |
| El prompt del implementador exigía `npm test`, que lobby no tiene | El prompt pide las comprobaciones que indiquen CLAUDE.md y README; `setup-node` sin caché npm |
| Carrera en el límite WIP y hueco ocupado si el implementador falla | Reserva optimista (recuenta tras poner la etiqueta) y job `liberar`. Prueba nueva |
| El revisor no podía leer el issue enlazado | `issues: read` en revisor y seguridad |
| Reglas de wrangler en lobby: `allow` de despliegue a un entorno `preview` inexistente y `deny` sin comodín | `deny` de `npx wrangler deploy *`, `versions *` y `npx wrangler@* *`; sin `allow` de despliegue |
| La CI de lobby no falla con claridad si `wrangler dev` no arranca | Comprobación tras el bucle con mensaje claro |
| `produccion.yml` no aplica migraciones remotas de D1 | Nota en el README de lobby |
| El revisor carga el `.claude/settings.json` del propio PR | Riesgo aceptado: la etiqueta solo la pone Álvaro y los hooks del plugin no dependen del PR. Mejora M10 |

### Segunda ejecución real: finance_tracker#2

El job `sensible` ya funciona: detectó ficheros sensibles y lanzó también al agente de seguridad.

| Agente | Turnos | Coste estimado | Resultado |
|---|---|---|---|
| Revisor (Opus) | 12 | 0,57 USD | CAMBIOS con 8 hallazgos |
| Seguridad (Sonnet) | 5 | 0,20 USD | Terminó sin publicar comentario (2 permisos denegados; la Action no guarda la transcripción) |

| Hallazgo | Resolución |
|---|---|
| `enjambre-investigar` y `enjambre-gobernanza` usan `cache: npm` y `npm ci` sin `package-lock.json` en la raíz: en finance_tracker fallarían siempre (alta) | Plantillas: solo `npm ci` si hay lockfile. Prueba para todos los workflows de agentes |
| La regla `deny` de push a `main` solo cubre la forma literal; el hook `bloquear-comandos` sí bloqueó el patrón durante la revisión | `deny` de refspecs hacia `main` en los dos proyectos |
| Faltaban `DEVOPS_CONTEXT.md` e `IMPLEMENTATION_STATUS.md` de finance_tracker | Sección «Agentes de Enjambre» con la certeza de cada dato |
| Sin issue y más de 400 líneas | Excepción de arranque, anotada en el PR |

Para saber por qué el agente de seguridad no publicó, los jobs de `revisar` llevan ahora `display_report: true`: el informe del agente queda en el resumen del run. Los repos son privados y solo los dispara el propietario. El prompt también pide que la última acción sea publicar el veredicto.

**Tras los cambios, segunda vuelta sobre finance_tracker#2** (revisor: 15 turnos y 0,78 USD; seguridad: 10 turnos y 0,27 USD): el revisor **APRUEBA**, con los hallazgos de la primera revisión resueltos. El agente de seguridad publica su veredicto, **CAMBIOS**:

| Hallazgo de seguridad | Resolución |
|---|---|
| Las reglas `deny` no cubren escrituras por la API de GitHub. El hook `bloquear-comandos` bloquea `gh api` con DELETE, PUT y PATCH, pero **no con POST**, y `POST /repos/…/merges` puede fusionar una rama en `main`. GitHub Free no protege `main` en repos privados | `deny` de `gh api` con POST o con campos (`-f`, `-F`, `--field`, `--input`) en lobby, finance_tracker y `plantillas/settings.proyecto.json`. Cambiar el hook lo aprueba Álvaro (regla 5): **mejora M11** |
| El marketplace `enjambre-publico` se descarga sin fijar a un commit: un cambio en él cambia a todos los agentes | Mitigado: solo Álvaro publica con `herramientas/publicar.mjs`. Fijar a una etiqueta o SHA es la **mejora M11** [POR CONFIRMAR qué sintaxis admite `plugin_marketplaces`] |
| `actions/checkout` deja las credenciales en `.git/config` del job `implementar` | Aceptado: hacen falta para empujar la rama. Solo lo lanza el propietario y no se etiquetan issues de terceros |
| Los `Read(...)` negados no cubren `cat` por Bash | Aceptado: lo cubre `proteger-secretos`, y en CI esos ficheros no existen |

Observaciones sobre el agente:
- Cita posiciones del diff (por ejemplo `:472`) en lugar de líneas del fichero. Mejora M9: ajustar el prompt del revisor.
- El hook `proteger-secretos` le impidió escribir rutas literales como `.dev.vars` en el cuerpo del comentario, porque el comentario va dentro del comando `gh pr comment`. Es un falso positivo que el agente esquivó con perífrasis. Cambiar el hook lo aprueba Álvaro (regla 5): mejora M9.
- Agotó `--max-turns 15` justo al terminar, también en la segunda vuelta de finance_tracker. Subido a 20 en la plantilla.
- Coste de las cinco ejecuciones: 2,74 USD estimados, unos 0,55 USD por revisión. Con Pro no se factura, pero gasta del plan.

## Consecuencias

- **Fase 2:** todo listo para el criterio de salida, que es una historia de Listo a PR verificado sin sesión local. Solo falta que Álvaro fusione lobby#1, porque los workflows de etiquetas en issues solo se activan desde `main`. Después, etiquetar un issue con `enjambre:planificar`.
- **Fase 3:** finance_tracker queda preparado como segundo proyecto con los mismos agentes ([finance_tracker#2](https://github.com/AlvaroM99/finance_tracker/pull/2)). Las evaluaciones se lanzan desde Actions (`gh workflow run evals.yml -R AlvaroM99/enjambre`) en cuanto exista el secreto en enjambre.
- Ningún agente ni esta sesión fusiona en `main` de los proyectos. Fusionar lobby#1, finance_tracker#1 y finance_tracker#2 lo hace Álvaro.
