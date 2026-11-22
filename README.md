# Enjambre

Equipo de agentes de Claude que trabaja como un equipo de desarrollo de software. Toma tareas de GitHub Issues, las planifica, las implementa, las revisa y las verifica. Las deja listas para que Álvaro las apruebe y las despliegue.

**Estado:** fase 1 cerrada por decisión y fases 2 y 3 en marcha ([ADR 0005](docs/decisiones/0005-cierre-f1-y-ci-cd.md)). El plugin `enjambre` tiene 10 agentes (coordinador, analista, jefe de proyecto, implementador, plataforma, revisor, seguridad, verificador, investigador y gobernanza), 13 skills y 4 hooks, con 360 pruebas y un banco de 20 evaluaciones de agentes (`evals/`, ejecutable en GitHub Actions con `evals.yml`; primer pass@1: 100 %). Fases 2 y 3 cerradas en todo lo que no necesita una sesión de Claude ([ADR 0007](docs/decisiones/0007-cierre-tecnico-f2-f3.md)); competencia y recursos públicos en [docs/panorama.md](docs/panorama.md). El 22-11-2026 se crearon los secretos, los agentes revisaron sus propios PR en GitHub ([ADR 0008](docs/decisiones/0008-secretos-y-primeras-ejecuciones.md)) y la primera historia por eventos en lobby llegó a PR fusionado: **F2 cumplida** ([ADR 0009](docs/decisiones/0009-repo-publico-versiones-y-primera-historia.md), [0010](docs/decisiones/0010-primer-intento-del-implementador.md)). Solo Álvaro aprueba PR: hook y job `aprobaciones` ([ADR 0011](docs/decisiones/0011-solo-alvaro-aprueba.md)). Organigrama y relaciones en [docs/organigrama.md](docs/organigrama.md). Hay una copia pública para instalar el plugin desde cualquier proyecto: [AlvaroM99/enjambre-publico](https://github.com/AlvaroM99/enjambre-publico) ([ADR 0006](docs/decisiones/0006-repo-publico-y-organigrama.md)). Hay CI del propio repo y plantillas de workflows de GitHub Actions para los proyectos. Falta la prueba de humo en una sesión real y el piloto en lobby ([riesgos y soluciones](docs/riesgos-y-soluciones.md)).

## Estructura

```
.claude-plugin/marketplace.json   marketplace privado (un solo plugin)
plugins/enjambre/                 el plugin: agents/, skills/, hooks/, scripts/
plugins/enjambre/skills/ci-cd/workflows/  plantillas de GitHub Actions para los proyectos
.github/workflows/                CI del propio repo (pruebas en Linux y Windows, gitleaks)
plantillas/                       settings, devcontainer y plantillas de plan, PR, ADR e informe QA
pruebas/                          pruebas de hooks, agentes, skills, workflows y evaluaciones (npm test)
evals/                            banco de 20 evaluaciones de agentes con fixtures
docs/                             plan, anexos, decisiones y operación
backlog/                          backlog en CSV
herramientas/publicar.mjs         publica una instantánea en el repo público (sin historial)
herramientas/actividad.mjs        resume actividad y tokens por agente
```

## Uso

```bash
npm test
```

```bash
claude plugin validate .
```

Publicar los cambios en el repositorio público (solo Álvaro, con el árbol limpio):

```bash
node herramientas/publicar.mjs
```

Instalar el plugin en un proyecto (ver [plantillas/README.md](plantillas/README.md)):

```bash
claude plugin install enjambre@enjambre --scope project
```

## Documentación

- [Plan](docs/PLAN.md): resumen, recomendaciones, vías, roadmap y riesgos.
- [Decisiones](docs/decisiones/): empieza por la [0001](docs/decisiones/0001-via-y-arranque.md).
- Anexos: [inventario](docs/anexos/A-inventario.md) · [arquitectura y seguridad](docs/anexos/B-arquitectura.md) · [fichas de agentes](docs/anexos/C-fichas-agentes.md) · [backlog](docs/anexos/D-backlog.md) ([CSV](backlog/enjambre-backlog.csv)) · [referencias](docs/anexos/E-referencias.md)
- [Auditoría de F1–F3](docs/auditoria-f1-f3.md): qué pedía el plan, qué hay y qué falta, con la prueba real del 22-11-2026.
- [F4 · Datos y BI](docs/fases/F4-datos-y-bi.md) y [F5 · Endurecimiento continuo](docs/fases/F5-endurecimiento.md): planes ([ADR 0012](docs/decisiones/0012-auditoria-y-rastro-de-agentes.md)).
- [Panorama](docs/panorama.md): competencia, alternativas, repositorios y bibliotecas públicas, y mejoras propuestas.
- [Evaluaciones](evals/README.md): banco de 20 tareas y cómo se ejecuta.
- [Organigrama](docs/organigrama.md): roles, relaciones, RACI, arnés y ecosistema (plugins, MCP, oficina de agentes).
- [Riesgos y soluciones](docs/riesgos-y-soluciones.md): retos encontrados y cómo se resuelven.
- [Operación](docs/operacion.md): línea base y estado del entorno.
- [Estado visual](docs/estado/enjambre-estado.html): página con el estado, la arquitectura y el roadmap.
