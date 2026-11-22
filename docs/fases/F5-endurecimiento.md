# F5 · Endurecimiento y operación continua: plan

- **Estado:** propuesta (22-11-2026). F5 no termina: es el ciclo con el que se revisa y mejora el arnés de los agentes (hooks, permisos, prompts, skills, workflows, guías, repos y versiones).
- **Criterio del plan:** 3 meses seguidos con las métricas de §7.2 en objetivo, medidas con F4.
- **Esfuerzo:** 4–6 h al mes.

## 1. El ciclo

```
 medir (F4, evals, transcripciones) → detectar (auditoría, QA, gobernanza, revisiones)
        ↑                                              │
 publicar versión (SHA)  ←  aprobar (Álvaro)  ←  proponer (issue, ADR, PR)
```

Toda mejora pasa por el mismo camino que una historia: propuesta, aprobación de Álvaro, PR con pruebas y evaluaciones sin regresión. Después, una versión nueva del plugin y un SHA nuevo en `ENJAMBRE_VERSION`. Los cambios de agentes, hooks o permisos los aprueba Álvaro (regla 5).

## 2. Cadencias

| Cada | Qué | Quién | Cómo |
|---|---|---|---|
| **Semana** | Banco de evaluaciones con el plugin actual | Sesión | `gh workflow run evals.yml -R AlvaroM99/enjambre` |
| | Uso del plan Pro | Álvaro | `npx ccusage blocks` |
| | Transcripciones con permisos denegados o paradas → ajustes de `limitar-bash` y prompts | Sesión | Artefactos `transcripcion-*` (ADR 0012) |
| | Cola de PR de agentes sin revisar (< 5) | Álvaro | GitHub |
| **Mes** | Auditoría de gobernanza e investigación QA en cada proyecto | Agentes | `enjambre-gobernanza` y `enjambre-investigar` (manuales) |
| | Dependabot: SHA de Actions; versión de `claude-code-action` y de la CLI (`CLAUDE_CODE_VERSION`) | Sesión + Álvaro | PR con evaluaciones antes y después |
| | Mejoras M pendientes: elegir 1 o 2 | Álvaro | Tabla de §4 |
| **Trimestre** | Revisión de permisos: settings, `limitar-bash`, permisos de los workflows, variables y secretos por repo | Sesión + Álvaro | ADR de revisión |
| | Revisar las vías B, D y E (SDK, Managed Agents, agent teams) frente a la C actual | Analista | Informe de estado del arte |
| | Ensayo de incidente: rotar el token y comprobar que todo sigue | Álvaro | Runbook R1 |
| **Año** | Renovar `CLAUDE_CODE_OAUTH_TOKEN` antes del **22-11-2027** | Álvaro | `docs/operacion.md` |

## 3. Líneas de trabajo

| Línea | Contenido | Historias |
|---|---|---|
| **Arnés y seguridad** | Hooks, permisos, falsos positivos y huecos; OpenSSF Scorecard en el repo público, que es gratis en repos públicos; perfil seccomp propio | S43, S54 (M9, M10), S64 (Scorecard), S65 (`limitar-bash` según transcripciones) |
| **Agentes y skills** | Prompts guiados por los hallazgos reales; skills nuevas | S66 (M15: el jefe planifica `.github/workflows/` como paso manual), S67 (M6: skills de TDD y depuración), S68 (skill `rust-worker` para finance_tracker) |
| **Calidad de los agentes** | Banco más difícil; una tarea nueva por cada defecto escapado | S57 (M12), S29 (lecciones aprendidas) |
| **Flujo y CI/CD** | Verificador en CI; entorno preview; rollback ensayado; `workflow_call` para la guardia; solo squash | S69 (verificador tras revisar), S17, S18, S70 (M16), S71 (M17) |
| **Guías y repositorios** | `AGENTS.md` por proyecto; runbooks; versión fija también en local | S72 (M1), S73 (runbooks R1–R4), S74 (M14) |
| **Uso real** | Las 4 historias que faltan de F1, una de plataforma y una de dos carriles con el coordinador | S23, S24, S75, S76 |

**Runbooks (S73):**
- R1: token comprometido o caducado.
- R2: un agente actúa fuera de su papel (parar los workflows y revisar la transcripción).
- R3: despliegue fallido y rollback (con S18).
- R4: actualizar la versión de Enjambre en un proyecto.

## 4. Mejoras pendientes (estado a 22-11-2026)

| Id | Mejora | Estado |
|---|---|---|
| M1 | `AGENTS.md` por proyecto | Pendiente (S72) |
| M2 | `ccusage` semanal | Cadencia semanal |
| M3 | `claude-code-security-review` en CI | Pendiente; el agente de seguridad ya cubre parte |
| M4 | Probar vibe-kanban | Pendiente (baja) |
| M5 | Specs al estilo Spec Kit para épicas | Pendiente (baja) |
| M6 | Skills de TDD y depuración | S67 |
| M7 | Panel de actividad y tokens | Pasa a F4 (S34) |
| M8 | Semilla sintética de lobby | **Segunda historia** ([lobby#8](https://github.com/AlvaroM99/lobby/issues/8)) |
| M9, M10 | Pulir revisor y `proteger-secretos`; `.claude/` desde la rama base | S54 |
| M11 | Escrituras por la API y plugin fijado por SHA | **Hecha** (ADR 0009) |
| M12 | Banco más difícil | S57 |
| M13 | Acción compuesta para instalar el plugin | Pendiente (baja) |
| M14 | Versión fija en local | S74 |
| M15 | El jefe planifica los workflows como paso manual; bloquear `--approve` | **Parte del hook hecha** (ADR 0011); falta el prompt (S66) |
| M16 | `workflow_call` para la guardia de aprobaciones | S70 |
| M17 | Solo squash merge | S71 (lo decide Álvaro) |

## 5. Primer trimestre propuesto

1. **Semanas 1–2:**
   - fusionar lobby#11 y finance_tracker#6 (rastro);
   - repetir analista, QA y gobernanza;
   - ajustar `limitar-bash` con las transcripciones (S65);
   - segunda historia (lobby#8) hasta la fusión.
2. **Semanas 3–4:** S66, S69 (verificador en CI), S64 (Scorecard) y S71.
3. **Mes 2:** F4 (S60–S63 y panel), con las historias S23 y S24 en paralelo para tener datos.
4. **Mes 3:** M12, runbooks y la primera revisión trimestral (permisos y vías).
