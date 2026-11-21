# 0002. Separación de repositorios y estructura del plugin

- **Fecha:** 21-11-2026
- **Estado:** Aceptada

## Contexto

Enjambre es una herramienta: un equipo de agentes. lobby, finance_tracker y los futuros proyectos son los proyectos en los que ese equipo trabaja. Hay que dejar claro qué vive en cada repositorio.

## Decisión

1. **Cada proyecto tiene su propio repositorio.**
   - `AlvaroM99/enjambre` contiene solo Enjambre: el plugin, las plantillas, las pruebas de los hooks, el plan y las decisiones.
   - `AlvaroM99/lobby` y `AlvaroM99/finance_tracker` siguen siendo independientes. Enjambre no guarda código ni datos de ellos.
2. **lobby es el proyecto piloto, no parte de Enjambre.** Se eligió por tres motivos: tiene pruebas de extremo a extremo, su stack JS se puede ejecutar en Windows y es pequeño. En lobby solo entrará lo que un proyecto necesita para usar Enjambre, y siempre por PR revisado por Álvaro:
   - `.claude/settings.json`, sacado de `plantillas/settings.proyecto.json`;
   - `.devcontainer/`;
   - CI.
3. **Marketplace y plugin en el mismo repo.** El marketplace es `.claude-plugin/marketplace.json` en la raíz y el plugin está en `plugins/enjambre/`. Es la estructura documentada (`source` relativo a la raíz del marketplace). `claude plugin validate` pasa en los dos niveles.
4. **Hooks en Node.js** (`plugins/enjambre/scripts/*.mjs`), sin dependencias:
   - funcionan igual en Windows y en el devcontainer de Linux;
   - fallan cerrados (entrada ilegible = bloqueo, `onFailure: block`);
   - se prueban con `node:test`.
5. **Los permisos no van en el plugin.** La documentación de plugins no contempla que un plugin traiga reglas de permisos. Las reglas `deny`/`allow` se copian a cada proyecto desde `plantillas/`, y las obligatorias del contenedor van en `managed-settings.json`.

## Consecuencias

- **El piloto en lobby no pasa por localhost.** La «línea base» de lobby se midió ejecutando sus pruebas locales (`wrangler dev` contra la base local) antes de que Enjambre toque nada. Sirve para comparar después. No cambió nada en el repo de lobby.
- **Lo que sale de Enjambre hacia lobby llega como PR**, igual que cualquier otro cambio.
