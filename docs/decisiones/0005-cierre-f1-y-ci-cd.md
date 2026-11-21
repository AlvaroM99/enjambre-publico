# 0005. Cierre de la fase 1, arranque de las fases 2 y 3 y CI/CD en GitHub Free

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

Álvaro da por terminada la fase 1 (MVP local) y pide empezar la 2 (automatización por eventos) y la 3 (ampliación del equipo). GitHub **se queda en Free**, y pide una CI/CD sólida con GitHub Actions.

El criterio de salida de F1 en el plan (§7) era «≥ 3 de 5 PR fusionados en lobby con ≤ 1 ciclo de cambios». **No se ha cumplido**: los agentes todavía no se han ejecutado en un proyecto real. Esta decisión lo deja escrito en lugar de ocultarlo.

## Decisión

### 1. F1 se cierra por decisión, con el piloto como primera puerta de F2

| Entregable de F1 | Estado |
|---|---|
| Plugin con agentes, skills y hooks probados | Hecho (ahora 7 agentes, 11 skills, 3 hooks; 218 pruebas) |
| Devcontainer, plantillas de permisos y de trabajo | Hecho |
| CI básico | Plantilla hecha (`ci-cd/workflows/ci.yml`); falta llevarla a lobby por PR |
| 5 historias reales en lobby | **Pasa a F2** como puerta de entrada |

**Puerta de F2:** antes de activar ningún workflow de agentes, una prueba de humo en una sesión real (lista en [riesgos y soluciones](../riesgos-y-soluciones.md), reto R1) y **2 historias de lobby** de punta a punta en local. Si fallan, se aplica el plan B del §9.2 del plan.

### 2. Fase 2: automatización por eventos, adaptada a GitHub Free

Las plantillas están en la skill `ci-cd` (`plugins/enjambre/skills/ci-cd/workflows/`):

| Workflow | Disparo |
|---|---|
| `ci.yml` | PR, push a `main`, manual |
| `enjambre-planificar.yml` | etiqueta `enjambre:planificar` puesta por el propietario |
| `enjambre-implementar.yml` | etiqueta `enjambre:implementar`, con límite WIP (`ENJAMBRE_WIP`) |
| `enjambre-revisar.yml` | etiqueta `enjambre:revisar` en un PR; añade seguridad si el PR toca ficheros sensibles |

Lo que sustituye a lo que Free no tiene en repos privados (rulesets, protección de rama, entornos con revisor):

1. **Solo el propietario dispara agentes** (`sender.login == repository_owner`).
2. Los hooks impiden a los agentes fusionar, hacer push a `main` o forzado, y desplegar.
3. **Producción solo manual** (`produccion.yml`): `workflow_dispatch`, propietario, rama `main` y escribir `DESPLEGAR`.
4. Actions fijadas por SHA, permisos mínimos, `concurrency`, `timeout-minutes` y nada de `pull_request_target`, comprobado por `npm test` (`pruebas/workflows.test.mjs`).
5. CODEOWNERS solo como sugerencia de revisor (sin efecto obligatorio en Free).

### 3. Fase 3: el equipo crece ya

Los agentes `plataforma` y `seguridad` (previstos para F3) y el nuevo `investigador` entran ahora (ADR 0003). Quedan para F3: `enjambre-investigar.yml` en modo semanal, `produccion.yml` en lobby, finance_tracker con Rust en CI y el banco de evaluaciones.

### 4. CI del propio repositorio de Enjambre

`.github/workflows/ci.yml`: `npm test` en Linux y Windows con Node 22 y 24, y gitleaks sobre todo el historial (binario verificado por SHA-256). `.github/dependabot.yml` propone actualizar los SHA de las Actions cada semana.

## Consecuencias

- **Los PR que abre un agente con `GITHUB_TOKEN` no disparan la CI** ([automatic token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)). Solución en F2: la CI también se dispara con `labeled` y `ready_for_review`, que hace Álvaro, y el implementador pasa las pruebas antes de abrir el PR. Solución completa: una GitHub App propia (S16), que crea Álvaro cuando lo decida.
- **El plugin privado en Actions:** para instalar `enjambre` desde el marketplace, el runner tiene que poder clonar el repo. Opciones: hacer público `enjambre` (no tiene datos reales ni secretos; lo vigila gitleaks) o la GitHub App. Lo decide Álvaro antes de activar el primer workflow de agentes.
- **Minutos de Actions:** cuota mensual limitada en privados con Free, y Windows cuenta más que Linux [POR CONFIRMAR cifras]. Se mide en las primeras semanas; si aprieta, la matriz de Windows se limita a `push` a `main`.
- **Límites de Claude:** los workflows de agentes gastan del mismo plan Pro que las sesiones locales. Por eso no hay ejecuciones programadas hasta que las métricas lo permitan.
- El plan (§7) se actualiza con el nuevo estado de las fases.
