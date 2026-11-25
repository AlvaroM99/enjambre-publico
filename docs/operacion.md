# Operación de Enjambre

## Línea base de lobby (21-11-2026, antes de Enjambre)

| Comprobación | Resultado | Tiempo |
|---|---|---|
| `npm run check` | 31 ficheros sin errores de sintaxis | < 5 s |
| `node herramientas/prueba.mjs` (contra `wrangler dev` local en 127.0.0.1:8787) | **60/60 correctas**, sin errores en la página | 61 s |

**Nota:** el README de lobby dice «43 comprobaciones», pero hoy son 60. Hay que corregirlo en lobby.

lobby no tiene CI todavía; se añade en la historia S14.

## Entorno

| Elemento | Estado |
|---|---|
| Claude | Plan Pro, sin API (ADR 0001) |
| Claude CLI | **2.1.330**, con instalador nativo, en `C:\Users\User\.local\bin\claude.exe`. **Esa carpeta aún no está en el PATH del usuario**: hay que añadirla (Variables de entorno → PATH de usuario) |
| GitHub | Plan Free; `gh` con la sesión de Álvaro (no se usa para los agentes) |
| Docker | Docker Desktop 29.9.3 (se actualizó solo durante la sesión). Imagen `enjambre-base` construida desde `plantillas/devcontainer`: **4 GB** según `docker images` (`enjambre-base:prueba`). El 1,2 GB que se anotó antes era el tamaño comprimido |
| Node / Python | 24.12.0 / 3.14.2 |
| Cloudflare | Workers `lobby` y `tracker`, D1 `lobby` y `tracker`, sin KV, R2 sin activar |

## Verificación de la fase 1 (21-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` (hooks) en Windows | 89/89 |
| `npm test` (hooks) dentro del contenedor Linux | 89/89 |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada (aviso: sin icono, irrelevante en un plugin privado) |
| Contenedor: Node, Chrome, Claude Code, gh, Python | v24, Chrome 158, Claude Code 2.1.330, gh 2.23, Python 3.11 |
| bubblewrap con seccomp por defecto | **Falla**: no puede crear espacios de nombres |
| bubblewrap con `seccomp=unconfined` | Funciona, con `/proc` propio |

**Sin comprobar todavía:**
- Claude Code con el sandbox activo dentro del contenedor, de punta a punta. Hace falta iniciar sesión en Claude dentro del contenedor, y lo hace Álvaro.
- Los hooks cargados de verdad por Claude Code al instalar el plugin en un proyecto. Las pruebas ejecutan los scripts con la misma entrada JSON que documenta Claude Code, pero no a través de Claude Code.

## Primera historia en finance_tracker: #11 (23-11-2026)

| Paso | Turnos | Coste | Bloqueos | Resultado |
|---|---|---|---|---|
| Analista | 6 | 0,10 USD | **0** | Informe publicado por el agente, con aviso de privacidad (no copiar la URL de despliegue de `tracker/README.md`) |
| Jefe de proyecto | 6 | 0,31 USD | **0** | Plan con 8 criterios verificables y decisiones por defecto P1–P5 |
| Investigador QA (alcance: crates de Rust) | 24 | 0,41 USD | 3 | Informe #17 y 2 propuestas: `ticker_a_yahoo` duplicada y divergente (#15) y falta de cobertura en CI (#16) |
| Puerta 1 (#11 y #15) | — | — | — | Aprobada por Álvaro («apruebo ambas») |
| Jefe en #15 (propuesta de QA) | 10 | 0,31 USD | 1 | Plan: unificar `ticker_a_yahoo` en `comun`, 7 criterios |
| Implementador #11 (carril 1) | 8 | 0,12 USD | 1 | **PR abierto por el agente**: [finance_tracker#18](https://github.com/AlvaroM99/finance_tracker/pull/18) |
| Implementador #15 (carril 2, en paralelo) | 9 | 0,14 USD | 1 | **PR abierto por el agente**: [finance_tracker#19](https://github.com/AlvaroM99/finance_tracker/pull/19) |
| CI (Rust + wasm) | — | — | — | Verde en los dos |
| Revisor | 6 y 7 | 0,28 y 0,29 USD | 0 | **APROBAR en los dos, sin cambios** (seguridad se omite: no tocan ficheros sensibles) |
| Atribución | — | — | — | Ningún commit con `Co-Authored-By: Claude` (corrección de lobby#6 confirmada) |

| Puerta 2 | — | — | — | Álvaro fusionó #18 (09:51:06 UTC) y #19 (09:51:27 UTC); issues cerrados y etiquetas de trabajo retiradas |

Primera vez con **dos carriles a la vez** (`enjambre:en-curso` en #11 y #15, WIP 3) y primera vez sin ningún ciclo de cambios.

**Medición.** El lead time cuenta desde la primera etiqueta que pone Álvaro en el issue hasta la fusión. Es la misma cuenta que en lobby, donde el issue se etiquetaba nada más crearlo. #11 y #15 eran propuestas de gobernanza y QA, así que el reloj empieza cuando Álvaro las coge.

| Historia | Lead time | Ciclos de cambios |
|---|---|---|
| lobby#2 | 4 h 31 min | 1 (los arregló la sesión) |
| lobby#8 | 14 h 16 min (incluye la noche hasta la fusión) | 1 (los arregló la sesión) |
| finance_tracker#11 | 1 h 59 min | **0** |
| finance_tracker#15 | 1 h 50 min | **0** |
| lobby#10 (primera con revisión automática) | **17 min** | **0** |
| lobby#9 (ADR retroactivos; fusionada sin revisión, ver ADR 0014) | 34 min | 0 |
| **Mediana (n = 6)** | **1 h 54 min** | 6 de 6 con ≤ 1 ciclo |

**Pasos que aún hizo una persona** entre el PR y la fusión:
- Álvaro pulsó «Approve workflows to run» para que corriera la CI.
- La sesión puso `enjambre:revisar` y marcó los PR como listos.

Álvaro pidió quitarlos («no quiero tener que aprobar yo el workflow de revisión») y quedar solo como último confirmador: [ADR 0014](decisiones/0014-revision-automatica.md). Los workflows nuevos llegan por [lobby#17](https://github.com/AlvaroM99/lobby/pull/17) y [finance_tracker#20](https://github.com/AlvaroM99/finance_tracker/pull/20).

**Fallo intermitente del e2e de lobby (23-11-2026).** El e2e de [lobby#17](https://github.com/AlvaroM99/lobby/pull/17) falló dos veces en las comprobaciones de Tareas, aunque ese PR solo cambia workflows. Igual que en lobby#16.
- En local pasó 9 de 9, y en CI con trazas, 7 de 7.
- Con una traza permanente en el propio test, el primer fallo dio la causa: la tarea se guardaba con el título «Tarea de pruebaprueba, lobby». El cajón pone el foco en el primer campo 60 ms después de abrirse (`public/js/ui.js`). En el runner, más lento, ese foco llegaba mientras Playwright escribía las etiquetas.
- Corregido en la app (el foco diferido ya no quita el cursor) y en el test, que ahora busca los campos dentro de su cajón, comprueba por el id que devuelve el POST e imprime `DIAG` si falla: [lobby#19](https://github.com/AlvaroM99/lobby/pull/19), CI en verde 4 de 4.
- Lección: un fallo intermitente sin traza no se arregla a ciegas. Primero hay que hacer que el test explique lo que ve.

**Coste por historia:** #11 ≈ 0,81 USD (analista, jefe, implementador y revisor); #15 ≈ 0,74 USD (jefe, implementador y revisor), sin contar la ejecución de QA que la encontró (0,41 USD).

Los bloqueos del investigador fueron `xargs` (correcto), `git -C` y un subshell `( cargo test … )`, estos dos falsos positivos menores de la siguiente tanda.

## Medir sin hacerlo a mano (F4, S60, 23-11-2026)

```
node herramientas/extraer.mjs --repo AlvaroM99/lobby --repo AlvaroM99/finance_tracker --desde 2026-11-20
node herramientas/metricas.mjs
```

- `extraer.mjs` usa tu sesión de `gh` (solo lectura). Escribe un JSON por repo en `.metricas/`, que no se sube al repositorio. Solo guarda números, fechas, identificadores y nombres de agente; los títulos sirven para enlazar y no se guardan. Con dos repos tardó 1 min 23 s.
- `metricas.mjs` imprime una tabla por historia y otra por agente, y escribe `.metricas/metricas.json`.

Primera ejecución, el 23-11-2026: las mismas cifras que a mano.
- 5 historias, lead time mediano 1 h 59 min, 5 de 5 con ≤ 1 ciclo.
- Coste conocido: 7,94 USD. Es parcial: las transcripciones duran 7 días y las de lobby#2 son de antes del ADR 0012.

**Segunda ejecución, el 23-11-2026, tras cerrar lobby#9:**
- 6 historias, lead time mediano 1 h 54 min, 6 de 6 con ≤ 1 ciclo.
- lobby#9 → #22: 34 min y ≈ 1,18 USD (parcial). Ese PR no tuvo veredicto del revisor: Álvaro lo fusionó antes de que llegara el arreglo de `allowed_bots`.
- Coste conocido: 9,12 USD. Permisos denegados del implementador: 16 en 6 ejecuciones.

**Primer dato nuevo, permisos denegados por agente** (de las transcripciones de esos días):

| Agente | Ejecuciones | Permisos denegados |
|---|---|---|
| Gobernanza | 2 | 27 |
| Implementador | 5 | 13 |
| Investigador | 2 | 6 |
| Analista | 2 | 4 |
| Jefe de proyecto | 4 | 4 |
| Seguridad | 2 | 2 |
| Revisor | 5 | 1 |

Son el insumo de la siguiente tanda de falsos positivos (S65); los cambios de hooks los aprueba Álvaro.

**Dos ajustes tras compararlo con la medición a mano** (con pruebas en `pruebas/metricas.test.mjs`):
- revisor y seguridad en la misma ronda cuentan un ciclo, no dos;
- la revisión lanzada por `workflow_dispatch` se enlaza con su PR por el veredicto que publicó durante la ejecución.

## Primera historia con revisión automática: lobby#10 → lobby#20 (23-11-2026)

Era una propuesta de gobernanza: README al día y los scripts de migración marcados como históricos. Sirvió para probar el [ADR 0014](decisiones/0014-revision-automatica.md).

| Paso | Turnos | Coste | Resultado |
|---|---|---|---|
| Jefe de proyecto | 11 | 0,52 USD | Plan de 10 criterios. Encontró dos cosas que la propuesta no decía: faltaban `semilla/` y `.claude/`, y mover los scripts habría dejado de comprobarlos en `npm run check` |
| Puerta 1 | — | — | «Approved, implement» |
| Implementador | 11 | 0,16 USD | Abrió [lobby#20](https://github.com/AlvaroM99/lobby/pull/20) solo (+20/−7) |
| `pedir-revision` | — | — | Borró la ejecución pendiente de aprobación y lanzó la CI (actor `github-actions[bot]`, en verde). **Falló al lanzar la revisión**: le faltaba `--ref` |
| Revisor | 6 | 0,24 USD | APROBAR. Lo lanzó la sesión con `workflow_dispatch` |
| `listo` | — | — | Pidió la revisión de Álvaro. **No** quitó el borrador: le faltaba `contents: write` (comprobado con un experimento) |
| Puerta 2 | — | — | Álvaro lo marcó listo y lo fusionó a las 11:32 |

Lead time: **17 min**, desde `enjambre:planificar` hasta la fusión. 0 ciclos de cambios. Coste ≈ 0,92 USD.

Los tres huecos (el `--ref` de la revisión, `contents: write` en `listo` y la CI invisible en el PR) se corrigieron en el plugin `v0.6.4` ([lobby#21](https://github.com/AlvaroM99/lobby/pull/21), [finance_tracker#21](https://github.com/AlvaroM99/finance_tracker/pull/21)). El job nuevo `estado-en-el-pr` ya se probó: dejó `ci (Enjambre): success` en el commit.

Falta probar en una historia de punta a punta, sin ninguna intervención, que la revisión arranca sola y que el PR llega listo.

## Segunda historia: lobby#8 → lobby#16 (23-11-2026)

| Paso | Resultado |
|---|---|
| Analista y jefe | Informe y plan (recuperados de la transcripción) |
| Implementador, 1.er intento | Hizo el trabajo, pero el push se rechazó porque tocaba `ci.yml`, y se quedó sin turnos (30). Corregido en lobby#15: no toca workflows y tiene 60 turnos |
| Implementador, 2.º intento | **Abrió el PR él solo** ([lobby#16](https://github.com/AlvaroM99/lobby/pull/16)): 41 turnos, 0,85 USD |
| Sesión | Paso de `ci.yml` y correcciones de las revisiones: `LOBBY_BASE` solo local (seguridad alta), recuento de hábitos, protección de la semilla, demos. Además, estabilización de `prueba.mjs` (grupos de la lista, cajón que se cierra, espera a la API) |
| Resultado | Revisor y seguridad APROBAR; CI 60/60 tres veces seguidas. **Fusionado por Álvaro** |
| Ejecución local (23-11-2026) | Clon limpio con credenciales sintéticas, `wrangler dev` en el puerto 8833 (el `wrangler dev` de Álvaro ocupaba el 8787) y Playwright con Chrome: humo 8/8, prueba **60/60**, repetición 60/60, y `LOBBY_BASE` no local rechazada. Clon borrado |

Workflows de finance_tracker al día con [finance_tracker#14](https://github.com/AlvaroM99/finance_tracker/pull/14) (implementador). Pendiente F5: el revisor agotó sus 20 turnos en la segunda revisión, aunque publicó el veredicto. Hay que subirle el límite como al implementador.

## Segunda prueba con rastro y falsos positivos de los hooks (ADR 0013, 22-11-2026)

| Agente | Turnos | Coste | Bloqueos | Resultado |
|---|---|---|---|---|
| Analista (lobby#8) | 18 | 0,33 USD | 4 | Informe publicado por el respaldo |
| Investigador QA | 13 | 0,18 USD | 3 | [lobby#12](https://github.com/AlvaroM99/lobby/issues/12) por el respaldo |
| Gobernanza | 25 | 0,40 USD | 12 | Recuperado de la transcripción: [lobby#14](https://github.com/AlvaroM99/lobby/issues/14) |
| Jefe (lobby#8) | 12 | 1,01 USD | 2 | Plan completo recuperado de la transcripción; **puerta 1 pendiente** |

De 21 bloqueos, 17 son falsos positivos (cuerpos de `gh` que mencionan «datos», `sed` de lectura, lectura de la configuración, bucles, `printenv ALCANCE`). Álvaro aprobó corregirlos: plugin `v0.6.1` en `ENJAMBRE_VERSION` de los dos proyectos. Al repetir los 21 bloqueos, 16 se permiten y 5 siguen bloqueados (4 correctos y uno ambiguo). Banco de evaluaciones: 20/20. Gobernanza en finance_tracker publicó su informe sola ([finance_tracker#8](https://github.com/AlvaroM99/finance_tracker/issues/8)).

Contar los bloqueos de una transcripción:

```bash
gh run download <run_id> -R AlvaroM99/lobby -D transcripciones
```

## Auditoría de F1–F3 y prueba real del sistema (ADR 0012, 22-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` | 326/326 (360/360 tras el ADR 0013) |
| `claude plugin validate` (marketplace y plugin) | Superada |
| Banco de evaluaciones en Actions con `v0.4.2` | 20/20 (1,26 USD) |
| Analista en lobby#8 | 22 turnos, 0,46 USD; informe perdido |
| Investigador QA en lobby | 12 turnos, 0,17 USD; sin issues |
| Gobernanza en lobby | 41 turnos (límite 20, falla); 2 propuestas (lobby#9, #10) |
| Rastro y respaldos | [lobby#11](https://github.com/AlvaroM99/lobby/pull/11), [finance_tracker#6](https://github.com/AlvaroM99/finance_tracker/pull/6); `ENJAMBRE_VERSION` = SHA de `v0.5.0` |

Ver la transcripción de un agente (artefacto de 7 días):

```bash
gh run download <run_id> -R AlvaroM99/lobby -n transcripcion-analista
```

Planes: [F4](fases/F4-datos-y-bi.md) y [F5](fases/F5-endurecimiento.md). Detalle: [auditoría](auditoria-f1-f3.md).

## F2 cerrada y solo Álvaro aprueba (ADR 0011, 22-11-2026)

| Comprobación | Resultado |
|---|---|
| Primera historia [lobby#2](https://github.com/AlvaroM99/lobby/issues/2) | **Cerrada**: PR lobby#5 fusionado por Álvaro. **F2 cumplida** |
| `npm test` en Windows | 325/325 |
| Hook `gh-pr-aprobar` | 7 comandos bloqueados y 3 permitidos en pruebas; activo en los proyectos con `ENJAMBRE_VERSION` = SHA de `v0.4.2` |
| Job `aprobaciones` | Probado en lobby#7: «PR abiertos revisados: 1; aprobaciones retiradas: 0». Tercera ronda: revisor y seguridad APROBAR |
| Ajuste «Allow GitHub Actions to create and approve pull requests» | **Activado** el 22-11-2026 en lobby y finance_tracker, tras fusionar lobby#7 y finance_tracker#5 (`can_approve_pull_request_reviews: true`, permisos por defecto del token: `read`) |

Comprobar el ajuste (solo lectura):

```bash
gh api repos/AlvaroM99/lobby/actions/permissions/workflow
```

## Primer intento del implementador (ADR 0010, 22-11-2026)

| Paso en [lobby#2](https://github.com/AlvaroM99/lobby/issues/2) | Resultado |
|---|---|
| Puerta 1 | Aprobada por Álvaro |
| `enjambre:implementar` | Hueco WIP reservado; plugin instalado desde el SHA fijado |
| Implementador | 5 turnos, 30 s, 0,11 USD, **sin PR y sin respuesta visible** |
| Corrección | Resumen en el issue, fallo sin PR (libera WIP), prompt más claro: [lobby#4](https://github.com/AlvaroM99/lobby/pull/4) y [finance_tracker#4](https://github.com/AlvaroM99/finance_tracker/pull/4) |
| 2.º intento | 8 turnos, 0,12 USD: rama `enjambre/2-npm-test` con 17 pruebas. GitHub no deja a Actions abrir el PR ni tocar `ci.yml`; los hizo la sesión: [lobby#5](https://github.com/AlvaroM99/lobby/pull/5) |
| Revisión de lobby#5 | CI verde; seguridad APROBAR; revisor CAMBIOS por `Co-Authored-By` (corregido en [lobby#6](https://github.com/AlvaroM99/lobby/pull/6); fusionar #5 con squash) |

## Primera historia, plugin versionado y evaluaciones (ADR 0009, 22-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 313/313 (325/325 tras el ADR 0011) |
| Banco de evaluaciones en Actions (`evals.yml`) | **pass@1 100 % (20/20)**, 1,23 USD estimados, unos 8 minutos |
| Primera historia: [lobby#2](https://github.com/AlvaroM99/lobby/issues/2) con `enjambre:planificar` | Plan publicado por el jefe (14 turnos, 0,76 USD). **Puerta 1: lo aprueba Álvaro** |
| Plugin fijado por SHA en [lobby#3](https://github.com/AlvaroM99/lobby/pull/3) | Instalado desde `$RUNNER_TEMP/enjambre-plugin`; revisor APROBAR |
| Hook `bloquear-comandos` con escrituras por `gh api` | 11 pruebas nuevas |

### Publicar una versión de Enjambre y llevarla a los proyectos

1. Sube `version` en `plugins/enjambre/.claude-plugin/plugin.json` y haz commit en `main`.
2. Publica. El script crea la etiqueta `v<versión>` e imprime el SHA:

```bash
node herramientas/publicar.mjs
```

3. En cada proyecto, pon ese SHA (no la etiqueta; las etiquetas se pueden mover):

```bash
gh variable set ENJAMBRE_VERSION -R AlvaroM99/lobby --body <sha>
```

```bash
gh variable set ENJAMBRE_VERSION -R AlvaroM99/finance_tracker --body <sha>
```

Sin una `ENJAMBRE_VERSION` válida, los workflows de agentes se paran. El repo público no necesita el secreto de Claude: no ejecuta agentes (ADR 0009).

## Secretos, repositorios y primeras ejecuciones reales (ADR 0008, 22-11-2026)

| Repositorio | `CLAUDE_CODE_OAUTH_TOKEN` | `ENJAMBRE_WIP` | Etiquetas | PR de integración |
|---|---|---|---|---|
| `AlvaroM99/lobby` | Creado el 22-11-2026 | 3 | `enjambre:*` y hallazgos | [lobby#1](https://github.com/AlvaroM99/lobby/pull/1) |
| `AlvaroM99/finance_tracker` | Creado el 22-11-2026 | 3 | `enjambre:*` y hallazgos | [finance_tracker#1](https://github.com/AlvaroM99/finance_tracker/pull/1) (CI) y [finance_tracker#2](https://github.com/AlvaroM99/finance_tracker/pull/2) (agentes) |
| `AlvaroM99/enjambre` | Creado el 22-11-2026 (para `evals.yml`) | — | — | — |
| `AlvaroM99/enjambre-publico` | No hace falta: no ejecuta agentes (ADR 0009) | — | — | — |

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 297/297 |
| Revisor en Actions sobre lobby#1 | Plugin instalado desde el repo público; 15 turnos; veredicto CAMBIOS con 10 hallazgos; 0,92 USD estimados |
| Hallazgos aplicados | Ver la tabla del ADR 0008 (job `sensible` con 403, WIP sin carreras, reglas de wrangler…) |
| Revisor y seguridad en Actions sobre finance_tracker#2 | 1.ª vuelta: CAMBIOS (8 hallazgos) y seguridad sin publicar; 2.ª: revisor APROBAR y seguridad CAMBIOS (hueco de `gh api` con POST, M11) |

### Renovar o cambiar el token (lo hace Álvaro)

1. Genera uno nuevo: `claude setup-token` (o con la ruta completa del ejecutable, `C:/Users/User/.local/bin/claude.exe setup-token`). Guárdalo en tu gestor de contraseñas; no lo pegues en chats ni ficheros.
2. Sustitúyelo en cada repo que lo usa (pide «Paste your secret»; pegarlo no se ve):

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/lobby
```

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/finance_tracker
```

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/enjambre
```

3. Comprueba los nombres (nunca se ve el valor): `gh secret list -R AlvaroM99/<repo>`.

Caduca al año (22-11-2027). La CLI no tiene orden para revocarlo y la web no lo documenta [POR CONFIRMAR].

### Ejecutar el banco de evaluaciones en Actions

```bash
gh workflow run evals.yml -R AlvaroM99/enjambre
```

```bash
gh workflow run evals.yml -R AlvaroM99/enjambre -f tarea=revisor-no-escribe
```

El resumen del run muestra la tabla de pass@1 y el JSON queda como artefacto `evals-resultados`.

## Fases 2 y 3: cierre técnico (ADR 0007, 21-11-2026)

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 286/286 |
| `node evals/ejecutar.mjs --simular` | 20 tareas válidas (10 agentes) |
| CI de lobby en [lobby#1](https://github.com/AlvaroM99/lobby/pull/1) | Verde: sintaxis, `npm audit` y prueba de humo 8/8 con credenciales sintéticas |
| CI de finance_tracker en [finance_tracker#1](https://github.com/AlvaroM99/finance_tracker/pull/1) | Verde: `cargo test` (comun, importar) y `cargo check` del Worker para wasm |
| Etiquetas `enjambre:*` en lobby | Creadas |
| Primera ejecución del banco de evaluaciones | **Pendiente**: la CLI no tiene sesión |

Tokens por agente: el hook `registrar-actividad` suma los tokens de la transcripción de cada subagente al terminar (formato de transcripción [POR CONFIRMAR] en sesión real). Resumen:

```bash
node herramientas/actividad.mjs ruta/a/actividad.jsonl
```

Uso del plan Pro por bloques de 5 horas (mejora M2 del panorama, lo ejecuta Álvaro):

```bash
npx ccusage blocks
```

## Repo público, secretos y oficina de agentes (ADR 0006, 21-11-2026)

### Agentes (10)

| Agente | Herramientas | Modelo | `maxTurns` | Aislamiento | Bash |
|---|---|---|---|---|---|
| `enjambre-coordinador` | Agent (solo agentes de Enjambre y Explore), Read, Grep, Glob, Bash | sonnet | 30 | — | lista blanca |
| `enjambre-analista` | Read, Grep, Glob, Bash, **WebSearch, WebFetch** | sonnet | 25 | — | lista blanca |
| `enjambre-gobernanza` | Read, Grep, Glob, Bash | sonnet | 20 | — | lista blanca + auditorías |

Los otros siete, en la sección siguiente. Organigrama, relaciones y RACI: [organigrama](organigrama.md).

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows | 258/258 |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada |
| Variable `ENJAMBRE_WIP=3` en `AlvaroM99/lobby` | **Creada** el 21-11-2026 con `gh variable set` |
| Secreto `CLAUDE_CODE_OAUTH_TOKEN` en `AlvaroM99/lobby` | **Creado** el 22-11-2026 (ADR 0008) |

### Publicar en el repositorio público

El privado (`AlvaroM99/enjambre`) es la fuente de verdad. Para llevar sus cambios al público (`AlvaroM99/enjambre-publico`), con el árbol limpio y en `main`:

```bash
node herramientas/publicar.mjs --prueba
node herramientas/publicar.mjs
```

La primera orden prepara el commit en una carpeta temporal sin subirlo; la segunda lo publica. El script copia los ficheros de `HEAD`, se niega si encuentra correos personales, tokens o claves, y firma con la dirección noreply de GitHub. No copia el historial privado.

### Crear el secreto `CLAUDE_CODE_OAUTH_TOKEN` (lo hace Álvaro)

Claude no puede hacerlo: el token se genera iniciando sesión con tu cuenta y es una credencial.

1. Abre PowerShell. Si `claude` no se encuentra, usa la ruta completa `C:\Users\User\.local\bin\claude.exe` (o añade esa carpeta al PATH de usuario).
2. Ejecuta `claude setup-token`. Se abre el navegador: inicia sesión con tu cuenta de Claude Pro y autoriza. La terminal muestra un token largo. **No lo pegues en ningún chat ni fichero.**
3. Ejecuta `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/lobby`. Cuando pida «Paste your secret», pega el token y pulsa Intro.
   - Alternativa web: GitHub → `lobby` → Settings → Secrets and variables → Actions → **New repository secret** → Name `CLAUDE_CODE_OAUTH_TOKEN` → pega el token → **Add secret**.
4. Comprueba que aparece el nombre (nunca el valor): `gh secret list -R AlvaroM99/lobby`.
5. Cierra la terminal para que el token no quede en pantalla.

El token gasta del mismo plan Pro que tus sesiones. Dura un año (https://code.claude.com/docs/en/authentication.md). Para renovarlo en todos los repos, ver la sección del ADR 0008 más arriba.

### Oficina de agentes: Pixel Agents

[Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT, unas 10 000 estrellas a 21-11-2026) muestra cada sesión de Claude Code como un personaje de píxeles en una oficina. Los subagentes aparecen como personajes propios. Escriben cuando editan, leen cuando buscan y avisan cuando esperan tu permiso. No modifica Claude Code ni el repositorio. Es código de terceros: lo instalas tú.

- **En VS Code:** Extensiones → busca «Pixel Agents» (editor `pablodelucca`) → Instalar → abre el panel **Pixel Agents** junto a la terminal → **+** → elige la carpeta del proyecto.
- **En el navegador:** `npx pixel-agents` (Node 20 o superior) y abre la URL que imprime. La URL lleva un `?token=`: trátala como una contraseña.

Ajustes recomendados para Enjambre:
- **No actives «Skip Permissions»**: equivale a `--dangerously-skip-permissions`, que Enjambre prohíbe fuera del devcontainer (ADR 0001).
- Crea un personaje por rol (coordinador, analista, jefe, implementador, plataforma, revisor, seguridad, verificador, investigador, gobernanza) y cuatro **Areas** en la oficina: Descubrimiento, Construcción, Calidad y Mejora continua.
- Activa **Watch All Sessions** si lanzas Claude fuera de la extensión. [POR CONFIRMAR] si detecta las sesiones de la app de escritorio.

Además, el hook `registrar-actividad` deja en `actividad.jsonl` (carpeta de datos del plugin) el inicio y el fin de cada agente de Enjambre, para medir tiempos por agente sin depender de herramientas externas.

## Equipo ampliado, Bash por agente y CI/CD (ADR 0003–0005, 21-11-2026)

| Agente | Herramientas | Modelo | `maxTurns` | Aislamiento | Bash |
|---|---|---|---|---|---|
| `enjambre-jefe-proyecto` | Read, Grep, Glob, Bash | opus | 20 | — | lista blanca (`limitar-bash`) |
| `enjambre-implementador` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 30 | worktree | completo (con `bloquear-comandos`) |
| `enjambre-revisor` | Read, Grep, Glob, Bash | opus | 15 | — | lista blanca |
| `enjambre-seguridad` | Read, Grep, Glob, Bash | sonnet | 15 | — | lista blanca |
| `enjambre-verificador` | Read, Grep, Glob, Bash, Write, Edit | sonnet | 25 | — | completo |
| `enjambre-investigador` | Read, Grep, Glob, Bash | sonnet | 25 | — | lista blanca (incluye pruebas) |
| `enjambre-plataforma` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 25 | worktree | completo |

Skills nuevas: `arnes-claude-code`, `tomar-decisiones`, `pedir-detalles`, `referencias-estandar` y `ci-cd` (con las plantillas de workflows en `skills/ci-cd/workflows/`).

| Comprobación | Resultado |
|---|---|
| `npm test` en Windows (hooks, `limitar-bash`, agentes, skills, plantillas y workflows) | 218/218 |
| Prueba de la prueba: quitar el SHA y el `timeout-minutes` de `produccion.yml` | fallan las 2 pruebas que deben |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada (mismo aviso de icono) |
| CI de GitHub Actions del repo | Sin ejecutar todavía: corre en el primer push |

**Sin comprobar todavía** (prueba de humo, reto R1 de [riesgos y soluciones](riesgos-y-soluciones.md)): la forma exacta de `agent_type` para agentes de plugin, `isolation: worktree` en agentes de plugin, `--agent enjambre:…` en `claude -p` y en la Action, y la instalación del plugin privado desde Actions.

## Agentes y skills del MVP (S9–S13, 21-11-2026)

> Histórico. Lo que cambia después está en la sección anterior y en los ADR 0003–0005.

| Agente | Herramientas | Modelo | `maxTurns` | Skills precargadas |
|---|---|---|---|---|
| `enjambre-jefe-proyecto` | Read, Grep, Glob, Bash (sin Edit/Write) | sonnet | 20 | reglas-enjambre, planificar |
| `enjambre-implementador` | Read, Edit, Write, Grep, Glob, Bash | sonnet | 30 | reglas-enjambre, git-enjambre, pruebas, documentar |
| `enjambre-revisor` | Read, Grep, Glob, Bash (sin Edit/Write) | sonnet | 15 | reglas-enjambre, pruebas, documentar |
| `enjambre-verificador` | Read, Grep, Glob, Bash, Write, Edit | sonnet | 25 | reglas-enjambre, pruebas, verificar-e2e |

Uso dentro de una sesión: `@agent-enjambre:enjambre-jefe-proyecto planifica el issue #12` (o pedir a Claude que delegue en ese agente).

Las plantillas (`plan.md`, `pr.md`, `adr.md`, `informe-qa.md`) están en `plantillas/` y se copian idénticas dentro de las skills que las usan, porque al instalar el plugin en otro proyecto solo viaja `plugins/enjambre/`. Una prueba de `npm test` falla si las copias se desvían.

| Comprobación | Resultado |
|---|---|
| `npm test` (hooks, agentes, skills y plantillas) en Windows | 115/115 |
| Prueba de la prueba: añadir `Edit` a `tools` del revisor | la prueba falla, como debe |
| `claude plugin validate .` y `./plugins/enjambre` | Validación superada; lista 4 agentes y 6 skills (mismo aviso de icono) |

**Limitaciones conocidas (documentadas):**
- **Bash no se puede limitar por comando en un subagente** (resuelto con el hook `limitar-bash`, ADR 0004). Un `disallowedTools` con `Bash(git push *)` quita todo Bash, y la documentación no contempla `tools: Bash(gh issue *)` ([sub-agents](https://code.claude.com/docs/en/sub-agents)). El jefe y el revisor necesitan Bash para `gh` y `git`, así que lo tienen entero. Lo que los frena: la lista de comandos permitidos en su prompt, las reglas `deny` del proyecto (`plantillas/settings.proyecto.json`), el hook `bloquear-comandos` y el sandbox del devcontainer. Con Bash podrían escribir ficheros (`echo > x`); el sandbox no lo impide dentro del proyecto.
- **Los agentes de un plugin ignoran `hooks`, `mcpServers` y `permissionMode`** ([sub-agents](https://code.claude.com/docs/en/sub-agents)). Por eso no se usan; los hooks van en `hooks/hooks.json` para todo el plugin.
- **Sin `memory`** en ningún agente: según la misma página, activarla da Read, Write y Edit automáticamente, y el revisor dejaría de ser de solo lectura. El anexo B §5.8 la preveía para revisor y verificador; queda pendiente de que Álvaro decida.
- **Sin `allowed-tools` en las skills:** los permisos no van en el plugin (ADR 0002, punto 5).

**Sin comprobar todavía:**
- **Opus en el plan Pro** (confirmado por Álvaro; jefe y revisor ya usan `opus`, ADR 0003). La CLI de esta máquina no tiene sesión iniciada (`claude auth status` → `loggedIn: false`), así que no se pudo comprobar con `/model`. Jefe y revisor usan `sonnet` y llevan un comentario en el frontmatter; si Pro permite Opus, basta con cambiar `model: opus` en esos dos ficheros [POR CONFIRMAR].
- **Nombres de skills en `skills:`.** Se usan con espacio de nombres (`enjambre:reglas-enjambre`), que es como las lista `claude plugin validate`. La documentación no dice si un agente de plugin también las encuentra sin prefijo [POR CONFIRMAR en una sesión real].
- **`${CLAUDE_SKILL_DIR}`** en las skills para localizar las plantillas: no se ha comprobado que se sustituya cuando la skill se precarga en un subagente. Si no, el agente ve el nombre del fichero y la carpeta de la skill igualmente [POR CONFIRMAR].
- **Una ejecución real de los cuatro agentes** (plan → PR → revisión → informe QA) en una sesión con el plugin instalado. Es la primera tarea del piloto en lobby (S9–S12, criterio «2 planes aceptados»).

## Evaluación de la v0.7.5 en los dos proyectos (25-11-2026)

Álvaro pidió relanzarlo todo en lobby y finance_tracker para evaluar la última versión:
- los 6 agentes en cada repo, más el banco de 20 evaluaciones;
- issues pequeñas de prueba;
- la puerta 1 aprobada por Claude desde Hive, solo para esta evaluación. Fusionar sigue siendo de Álvaro.

Las cifras salen de las transcripciones (`transcripcion-*`) de cada ejecución.

**Banco de evaluaciones** (Actions, `evals.yml`): **20/20, pass@1 100 %**, en 9 min. Cubre los 10 agentes, con las mismas tareas que la v0.6.1.

**Flujo completo:**

| Repo | Agente | Resultado | Turnos | Coste | Denegados | Errores del token |
|---|---|---|---|---|---|---|
| lobby (#28) | analista | ✔ | 11 | 0,18 USD | 0 | 0 |
| lobby | jefe de proyecto | ✔ plan «## Plan de Enjambre» | 15 | 0,48 USD | 0 | 0 |
| lobby | implementador (puerta 1 desde Hive) | ✔ lobby#29 **listo para revisión** | 12 | 0,17 USD | 0 | 0 |
| lobby | CI lanzada sola | ✔ `ci (Enjambre): success` en el PR | — | — | — | — |
| lobby | revisor | ✔ **APROBAR** y revisión pedida a Álvaro | 15 | 0,35 USD | 0 | 0 |
| lobby | investigador | ✔ informe lobby#31 | 9 | 0,16 USD | 1 (`node -e`) | 0 |
| lobby | gobernanza | ✖ job en rojo por turnos (46/45), con el informe lobby#32 y 5 issues publicados | 46 | 0,38 USD | 1 (`gh variable list`) | 0 |
| finance_tracker (#30) | analista | ✔ | 10 | 0,11 USD | 0 | 0 |
| finance_tracker | jefe de proyecto | ⚠ plan titulado «# Plan» (dos veces) | 13 y 14 | 0,35 + 0,35 USD | 0 | 0 |
| finance_tracker | investigador | ✔ informe finance_tracker#32 | 10 | 0,18 USD | 0 | 0 |
| finance_tracker | gobernanza | ✔ informe #34 y 1 issue (#33) | 42 | 0,37 USD | 3 (`git grep` de datos) | 0 |

**Total:** ≈ 3,1 USD sin contar el banco.

**Cambios respecto a antes de la v0.7.x:**
- **Errores del token:** cero en todos los agentes. Antes los había en el jefe, en gobernanza y en el revisor.
- **Comandos de salida:** ningún agente tuvo denegado el suyo. Antes se denegaban `gh issue comment` del analista y del jefe, `gh issue create` de gobernanza y `gh pr comment` del revisor.
- **PR del implementador:** sale listo para revisión, con la CI y la revisión arrancadas solas.
- **Hive:** sirvió para todo el flujo (crear las issues, pedir el análisis y el plan, aprobar el plan). Además se negó a implementar finance_tracker#30 sin un plan reconocible.

**Hallazgos, corregidos:**
- **v0.7.6:** el jefe debe empezar el plan por «## Plan de Enjambre», y el implementador y Hive aceptan «# Plan» o «## Plan».
- **v0.7.7:** gobernanza pasa de 45 a 60 turnos.

**Pendiente:**
- **finance_tracker#30:** el implementador y la revisión, cuando Álvaro fusione la v0.7.6 y la v0.7.7 (finance_tracker#31).
- **Investigar desde Hive:** dio 403. La app tiene «Actions: Read and write» en su configuración, pero la instalación aún no ha aceptado el cambio.
