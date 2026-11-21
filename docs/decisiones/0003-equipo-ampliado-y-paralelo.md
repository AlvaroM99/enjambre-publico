# 0003. Equipo ampliado, trabajo en paralelo y Opus

- **Fecha:** 21-11-2026
- **Estado:** Aceptada
- **Decide:** Álvaro

## Contexto

El MVP tiene 4 agentes y un límite WIP de 1 (ADR 0001). Álvaro pide:

1. más implementadores y revisores, porque puede haber **hasta 6 issues en paralelo**;
2. que QA no sea solo verificar: un probador e **investigador del código** que dé retroalimentación sobre los implementadores y **abra sus propios issues**;
3. confirma que su plan **Pro incluye Opus**.

El plan original (D1, D6) recomendaba un equipo pequeño y 2–3 PR a la vez por coste y conflictos. Esta decisión lo amplía, manteniendo el principio de **un solo escritor por historia** (D1, Cognition, MAST).

## Decisión

### 1. Más instancias, no más definiciones

En Claude Code un agente es una **definición**; se pueden lanzar varias instancias a la vez, que se ejecutan en segundo plano y en paralelo ([sub-agents](https://code.claude.com/docs/en/sub-agents)). Por eso «más implementadores» no son ficheros nuevos: son **carriles**.

- **Carril** = una historia = una instancia de `enjambre-implementador` = una rama `enjambre/<clave>-<slug>` = un worktree.
- Cada PR lo revisa **su propia instancia** de `enjambre-revisor` (y de `enjambre-seguridad` si toca ficheros sensibles).
- El implementador y el agente de plataforma llevan `isolation: worktree`: cada instancia trabaja en su copia del repositorio. Si el campo no se aplica a agentes de plugin [POR CONFIRMAR: la documentación no lo incluye entre los campos ignorados, pero tampoco lo confirma], la skill `git-enjambre` explica cómo crear el worktree a mano.
- El jefe de proyecto solo pone en paralelo historias **independientes** (sin ficheros, migraciones ni API compartidos) y devuelve una tabla de carriles.

### 2. Límite WIP configurable: 3 por defecto, 6 como máximo

- Máximo **6** carriles, como pide Álvaro.
- Por defecto **3**, porque todos los carriles gastan del mismo plan Pro. Se sube a 6 cuando las métricas lo permitan (ver «Límites de uso»).
- En CI lo hace cumplir `enjambre-implementar.yml` con la variable del repositorio `ENJAMBRE_WIP` y la etiqueta `enjambre:en-curso`.

### 3. Tres agentes nuevos (adelanto de la fase 3)

| Agente | Qué hace | Escribe | Modelo |
|---|---|---|---|
| `enjambre-investigador` | QA exploratorio: busca fallos, casos límite, pruebas que faltan y desvíos del plan; da retroalimentación sobre patrones de los implementadores; abre issues `enjambre:propuesta` (máx. 5 por encargo, solo reproducibles) | no (solo issues) | sonnet |
| `enjambre-seguridad` | revisor de seguridad de PR sensibles y auditoría de dependencias (OWASP ASVS, Top 10, Scorecard) | no (solo comentarios e issues) | sonnet |
| `enjambre-plataforma` | CI/CD con GitHub Actions, devcontainer, procedimiento de despliegue y rollback | sí, en su rama y worktree | sonnet |

El **verificador** sigue comprobando criterios de aceptación de cada PR y añade a su informe una sección «Para el implementador» con patrones repetidos.

Las propuestas del investigador y de seguridad **no entran solas en el backlog**: la etiqueta `enjambre:propuesta` la tría el jefe de proyecto y la acepta Álvaro. Así se evita que los agentes se generen trabajo a sí mismos sin control.

### 4. Modelos

| Agentes | Modelo |
|---|---|
| Jefe de proyecto, revisor | `opus` (confirmado por Álvaro en su plan Pro) |
| Implementador, plataforma, verificador, investigador, seguridad | `sonnet` |

Opus solo donde el razonamiento pesa más y hay pocas ejecuciones. Primer ajuste si se topan los límites: revisor a `sonnet` en PR de tamaño S.

### 5. Skills nuevas

| Skill | Para qué | La precargan |
|---|---|---|
| `arnes-claude-code` | subagentes, paralelo, worktrees, modelo por rol, hooks, contexto, CI | jefe |
| `tomar-decisiones` | elegir entre alternativas con criterios ponderados y registrar la decisión | jefe, plataforma |
| `pedir-detalles` | cuándo preguntar y cuándo suponer; preguntas cerradas con propuesta por defecto | jefe, implementador, investigador |
| `referencias-estandar` | criterios para elegir dependencias, librerías y repos de referencia, estándares de proceso y seguridad | jefe, implementador, revisor, investigador, seguridad, plataforma |
| `ci-cd` | reglas y plantillas de GitHub Actions (ADR 0005) | plataforma |

## Consecuencias

### Límites de uso (el riesgo principal)

El plan original estimaba que un sistema multiagente consume de 4 a 15 veces más tokens que un chat (§0.4). Seis carriles con revisor y verificador pueden ser 18 ejecuciones de agente por ciclo. Medidas:

- WIP 3 por defecto; Opus solo en 2 roles; `maxTurns` bajos (≤ 30).
- Registrar cada bloqueo por límite en `docs/operacion.md`.
- **Señal para subir WIP** a 4–6: dos semanas sin bloqueos por límite.
- **Señal para Max 5x** (sin cambios respecto a ADR 0001): más de 2 bloqueos por límite a la semana durante 2 semanas.

### Conflictos entre carriles

Mitigados con carriles independientes, PR de menos de 400 líneas y ramas cortas. El orden de fusión lo decide Álvaro; las ramas posteriores se actualizan con `git merge origin/main` (sin `push --force`).

### Cuello de botella humano

Seis PR a la vez son seis revisiones para Álvaro. El revisor, seguridad y el verificador filtran antes; Álvaro revisa el 100 % de los PR hasta que la tasa sin retrabajo supere el 60 % (objetivo F3), y después por muestreo.

### Cambios en las pruebas

`npm test` comprueba los 7 agentes, las 11 skills, que solo jefe y revisor usan Opus, que implementador y plataforma llevan `isolation: worktree` y que los agentes de solo lectura no tienen herramientas de escritura.
