# 0007. Cierre técnico de las fases 2 y 3

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

Álvaro pide terminar las fases 2 (automatización por eventos) y 3 (ampliación del equipo). Parte del trabajo depende de cosas que solo puede hacer él: iniciar sesión en la CLI de Claude (`claude auth status` → `loggedIn: false`), crear el secreto `CLAUDE_CODE_OAUTH_TOKEN` y fusionar los PR.

## Decisión

Se cierra **todo lo que no depende de una sesión de Claude**. Lo que depende de ella queda listo para ejecutarse con una orden y se marca como pendiente de Álvaro.

### Fase 2

| Entregable | Estado | Dónde |
|---|---|---|
| Plugin instalable desde Actions | Hecho | repo público `AlvaroM99/enjambre-publico` (ADR 0006) |
| Settings, devcontainer, plantilla de PR y CODEOWNERS en lobby | Hecho, PR abierto | [AlvaroM99/lobby#1](https://github.com/AlvaroM99/lobby/pull/1) |
| CI de lobby (S14) con credenciales sintéticas (S42) | Hecho, **CI en verde** (8/8 en la prueba de humo) | mismo PR; `herramientas/humo.mjs` |
| Workflows de agentes por etiquetas (S19–S21) | Hecho, en el PR | `enjambre-analizar|planificar|implementar|revisar` |
| Etiquetas `enjambre:*`, `necesita-humano`, `qa`, `seguridad`, `gobernanza` en lobby | Hecho | GitHub |
| Variable `ENJAMBRE_WIP=3` en lobby | Hecho | GitHub |
| Secreto `CLAUDE_CODE_OAUTH_TOKEN` en lobby | **Álvaro** | pasos en `docs/operacion.md` |
| Prueba de humo en sesión real (S41) y primera historia por eventos | **Álvaro** (necesita sesión) | — |

### Fase 3

| Entregable | Estado | Dónde |
|---|---|---|
| 10 agentes, 13 skills, 4 hooks | Hecho | `plugins/enjambre/` |
| Carriles en paralelo con worktrees y WIP | Hecho | ADR 0003 |
| CI de finance_tracker con Rust (S32) | Hecho, **CI en verde** (pruebas y compilación wasm) | [AlvaroM99/finance_tracker#1](https://github.com/AlvaroM99/finance_tracker/pull/1) |
| Tokens por agente (S25) | Hecho | hook `registrar-actividad` y `herramientas/actividad.mjs` |
| Banco de 20 evaluaciones (S28) | Hecho, validado en simulación | `evals/` |
| Primera ejecución del banco y pass@1 de referencia | **Álvaro** (necesita sesión) | `node evals/ejecutar.mjs` |
| Investigación QA y auditoría de gobernanza reales | Tras fusionar lobby#1 | workflows manuales |

### Decisiones tomadas por el camino

1. **La prueba completa de lobby (`prueba.mjs`) no corre en CI.** Depende de los datos reales de la base local (por ejemplo, que «ocarina» dé 4 títulos). En CI corre `humo.mjs`, que no depende de datos. Una semilla sintética para la prueba completa queda como mejora M8 ([panorama](../panorama.md)).
2. **finance_tracker no activa el plugin de Enjambre.** Su regla 7 pide autorización para cambios de herramientas; el PR solo añade CI.
3. **Las evaluaciones usan fixtures propios** con fallos sembrados en lugar de commits reales de lobby: el historial de lobby tiene 3 commits grandes que no sirven como tareas pequeñas comprobables.

## Consecuencias

- Criterio de salida de F2 («una historia de Listo a PR verificado sin abrir sesión local») y de F3 (lead time < 2 días, ≥ 60 % sin retrabajo) **no se pueden medir** hasta que Álvaro cree el secreto, fusione lobby#1 y ejecute la primera historia. Todo lo demás está hecho y probado.
- Orden para Álvaro: (1) secreto, (2) fusionar lobby#1 y finance_tracker#1, (3) iniciar sesión en la CLI y `node evals/ejecutar.mjs`, (4) etiquetar un issue de lobby con `enjambre:planificar`.
