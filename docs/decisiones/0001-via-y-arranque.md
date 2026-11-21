# 0001. Vía de ejecución y condiciones de arranque

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

El [plan](../PLAN.md) compara seis vías y recomienda empezar por la A (subagentes de Claude Code, en local) y pasar después a la C (los mismos agentes lanzados por eventos de GitHub con `claude-code-action`). Antes de arrancar hacía falta saber qué cuentas y planes hay disponibles.

## Decisión

**Vía A → C.** El MVP se hace en local, dentro de un devcontainer de Docker. La automatización por eventos llega en la fase 2.

Respuestas a las preguntas abiertas del plan (§0.1):

| Pregunta | Respuesta | Certeza |
|---|---|---|
| P1–P2 Jira | No por ahora: **solo GitHub Issues + Projects** | Confirmado |
| P3 Plan de Claude | **Pro**, sin cuenta de API | Confirmado |
| P7 Plan de GitHub | **Free** | Confirmado |
| P9 Aislamiento | **Docker** (devcontainers) | Confirmado |
| Repo `AlvaroM99/enjambre` | Privado, autorizado | Confirmado |
| P4, P5, P6, P8, P10–P13 | Sin contestar: se aplica provisionalmente la propuesta del plan | Pendiente |

## Consecuencias

### Plan de Claude Pro sin API
- Las vías B (Agent SDK) y D (Managed Agents) quedan **descartadas por ahora**, porque las dos necesitan API de pago por uso.
- En la fase 2, la Action se autentica con `claude_code_oauth_token` (lo genera `claude setup-token`) y gasta los límites de la suscripción Pro.
- Los límites de Pro son el principal cuello de botella:
  - **WIP 1** (una sola historia en curso), en lugar de 2.
  - Modelo por defecto **Sonnet 5.5** en todos los agentes. Opus solo para jefe de proyecto y revisor si el plan lo permite [POR CONFIRMAR con `/model`]. Haiku para exploración.
  - `maxTurns` bajos y nada de ejecuciones programadas en la fase 1.
- **Señal para pasar a Max 5x** (100 $/mes): más de 2 bloqueos por límite a la semana durante 2 semanas seguidas.

### Solo GitHub (sin Jira)
- Se aplica la discrepancia D13: GitHub Issues con etiquetas `enjambre:*` y un GitHub Project con los estados del flujo.
- La historia S22 (integración con Jira) baja a prioridad baja y queda condicionada a una decisión futura.
- El CSV del backlog sigue en formato importable a Jira por si se reconsidera.

### GitHub Free con repos privados
En los repos privados con plan Free **no hay** rulesets, protección de rama ni entornos con revisor obligatorio. Lo que lo compensa:
1. **Bloqueo en los hooks**, no en GitHub: `bloquear-comandos` impide a los agentes `gh pr merge`, `git push` a `main` y `push --force`.
2. **La identidad de los agentes no puede fusionar.** Si se usa GitHub App (P8), se le dan los permisos mínimos y la fusión la hace siempre Álvaro desde su cuenta.
3. **Producción sigue siendo manual**, igual que ahora en lobby: `npm run deploy` lo lanza Álvaro. No habrá workflow de CD a producción mientras no haya entornos protegidos.
4. `CODEOWNERS` se mantiene, pero solo sirve para sugerir revisores.
5. Cambian las historias **S15** (pasa a «CODEOWNERS + hooks + disciplina») y **S18** (pasa a «procedimiento manual de producción y rollback documentado»).
6. **Revisión prevista:** pasar a GitHub Pro (4 $/mes) o hacer público `enjambre` (no tiene datos reales) si se demuestra que hace falta protección real.

### Docker
- Los agentes en modo autónomo se ejecutan siempre en un devcontainer (historia S5). Nunca se ejecutan con `bypassPermissions` en Windows.

## Coste resultante

**20 $/mes** (Claude Pro). GitHub, Cloudflare y Docker no cuestan nada.
