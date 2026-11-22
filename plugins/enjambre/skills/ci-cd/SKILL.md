---
name: ci-cd
description: CI/CD de Enjambre con GitHub Actions en el plan Free - reglas para escribir workflows seguros (SHA fijados, permisos mínimos, concurrency, sin pull_request_target), plantillas de CI, de los workflows de agentes (planificar, implementar con límite WIP, revisar, investigar) y de despliegue manual a producción, y qué compensa lo que GitHub Free no tiene. Úsala al crear o cambiar workflows o al preparar un proyecto para Enjambre.
---

# CI/CD con GitHub Actions (GitHub Free)

GitHub Free en repos privados no tiene protección de rama, rulesets ni entornos con revisor obligatorio (ADR 0001). La CI/CD de Enjambre lo compensa con workflows que **solo dispara Álvaro**, hooks que impiden a los agentes fusionar o desplegar, y producción siempre manual.

## 1. Plantillas

En la carpeta `workflows/` de esta skill (`${CLAUDE_SKILL_DIR}/workflows/`). Se copian a `.github/workflows/` del proyecto **por PR**, nunca directamente a `main`.

| Plantilla | Disparo | Qué hace | Fase |
|---|---|---|---|
| `ci.yml` | PR, push a main, manual | `npm ci`, `npm run check`, `npm test`, `npm audit`; e2e local (desactivado hasta adaptarlo) | 1 |
| `enjambre-planificar.yml` | etiqueta `enjambre:planificar` en un issue | el jefe de proyecto publica el plan | 2 |
| `enjambre-implementar.yml` | etiqueta `enjambre:implementar` | comprueba el límite WIP (`vars.ENJAMBRE_WIP`, 3 por defecto, máx. 6) y un implementador abre el PR en borrador | 2 |
| `enjambre-revisar.yml` | etiqueta `enjambre:revisar` en un PR | revisor de código; revisor de seguridad si toca ficheros sensibles | 2 |
| `enjambre-investigar.yml` | manual (semanal más adelante) | el investigador abre issues `enjambre:propuesta` | 3 |
| `enjambre-analizar.yml` | etiqueta `enjambre:analizar` en un issue | el analista publica el informe de estado del arte | 3 |
| `enjambre-gobernanza.yml` | manual (mensual más adelante) | auditoría de gobernanza y propuestas | 3 |
| `produccion.yml` | manual, escribiendo `DESPLEGAR` | pruebas y `wrangler deploy`, solo el propietario y solo desde `main` | 3 |

## 2. Reglas para cualquier workflow

1. **Actions de terceros fijadas por SHA completo**, con la versión en un comentario: `uses: actions/checkout@<40 caracteres> # v7.0.1`. Para obtener el SHA: `gh api repos/<dueño>/<repo>/git/ref/tags/<versión>`.
2. **`permissions:` a nivel de workflow en `contents: read`** y lo que haga falta, por job.
3. **`persist-credentials: false`** en `actions/checkout` salvo en el job que tiene que hacer push.
4. **`concurrency`** en todos: por PR o por issue, para no duplicar ejecuciones.
5. **`timeout-minutes`** en todos los jobs.
6. **Nunca `pull_request_target`** con checkout del código del PR, ni workflows que se disparen con PR de forks con secretos.
7. **Nada de `${{ github.event.* }}` con texto de usuarios dentro de `run:`** (títulos, cuerpos, ramas): pásalo por `env:` y úsalo entre comillas.
8. **Solo el propietario dispara agentes**: `github.event.sender.login == github.repository_owner` (o `github.actor` en `workflow_dispatch`).
9. **Secretos solo donde se usan**, como `env:` del paso. Nunca `echo` de un secreto.
10. Workflows de producción: solo `workflow_dispatch`, propietario, rama `main` y confirmación escrita.

`npm test` del repo de Enjambre comprueba las reglas 1, 2, 4, 5 y 6 en todas las plantillas (`pruebas/workflows.test.mjs`).

## 3. Secretos y variables que crea Álvaro

| Nombre | Tipo | Para qué | Cómo |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | secreto | que la Action use el plan Pro | `claude setup-token` en local |
| `ENJAMBRE_WIP` | variable | historias a la vez (1–6) | Settings → Secrets and variables → Actions → Variables |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | secretos | solo `produccion.yml` | token de Cloudflare con permisos mínimos |

Los agentes **no** crean ni leen secretos (`gh secret` está bloqueado por `bloquear-comandos`).

## 4. Particularidades que hay que conocer

- **Los PR y pushes hechos con `GITHUB_TOKEN` no disparan otros workflows** (salvo `workflow_dispatch` y `repository_dispatch`). Por eso el implementador pasa las pruebas antes de abrir el PR, y `ci.yml` también se dispara con `labeled` y `ready_for_review`: cuando Álvaro etiqueta el PR, la CI corre. Con una GitHub App propia (`enjambre-bot`) esto desaparece. Fuente: https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication
- **El plugin se instala desde una versión fija del marketplace público** `AlvaroM99/enjambre-publico` (ADR 0006 y 0009). `plugin_marketplaces` solo acepta URLs `.git` o rutas locales, sin `#ref` ([install-plugins.ts](https://github.com/anthropics/claude-code-action/blob/acfe7992852970efb4fee683d63d628e3e52df67/base-action/src/install-plugins.ts)). Por eso cada job hace checkout de la etiqueta `vars.ENJAMBRE_VERSION` (o la de la plantilla), la saca del espacio de trabajo a `$RUNNER_TEMP` y pasa esa ruta. Álvaro publica con `node herramientas/publicar.mjs` y crea la etiqueta; un cambio en `main` del repo público no llega a los proyectos hasta que se sube la versión.
- **`--agent enjambre:<agente>` en `claude_args`**: nombre con espacio de nombres del plugin. Confirmado en la primera ejecución real (22-11-2026, ADR 0008).
- **Minutos**: los repos privados con Free tienen una cuota mensual de minutos de Actions, y los runners de Windows cuentan más que los de Linux [POR CONFIRMAR la cifra en https://docs.github.com/en/billing/concepts/product-billing/github-actions]. Mide los minutos por historia en las primeras semanas.
- **Límites del plan de Claude**: cada workflow de agente gasta del mismo plan Pro que las sesiones locales. Empieza con `ENJAMBRE_WIP=3` (ADR 0003).

## 5. Cómo probar un workflow

1. Rama `enjambre/<clave>-ci-...` y PR en borrador.
2. Los workflows con `pull_request` corren en el propio PR; los de `issues` o `workflow_dispatch` solo existen cuando están en `main`, así que se prueban después de fusionar, con un issue de prueba.
3. Enlaza la ejecución en el PR y anota los minutos que ha consumido.

## Fuentes

- Endurecer GitHub Actions: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- Claude Code en GitHub Actions: https://code.claude.com/docs/en/github-actions y https://github.com/anthropics/claude-code-action (entradas en `action.yml`)
- OpenSSF Scorecard (Pinned-Dependencies, Token-Permissions, Dangerous-Workflow): https://scorecard.dev/
