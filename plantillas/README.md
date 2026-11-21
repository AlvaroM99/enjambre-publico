# Plantillas para proyectos que usan Enjambre

## Plantillas de trabajo de los agentes

| Fichero | Para qué | Copia dentro del plugin |
|---|---|---|
| `plan.md` | plan de una historia (jefe de proyecto) | `skills/planificar/plantilla-plan.md` |
| `adr.md` | registro de una decisión | `skills/planificar/plantilla-adr.md` |
| `pr.md` | cuerpo del PR en borrador (implementador). Se puede copiar a `.github/pull_request_template.md` del proyecto | `skills/git-enjambre/plantilla-pr.md` |
| `informe-qa.md` | informe PASA/FALLA por criterio (verificador) | `skills/verificar-e2e/plantilla-informe-qa.md` |
| `investigacion.md` | informe de estado del arte (analista) | `skills/investigar-estado-del-arte/plantilla-investigacion.md` |
| `gobernanza.md` | informe de gobernanza con nota por área | `skills/gobernanza/plantilla-gobernanza.md` |

Las copias existen porque al instalar el plugin solo viaja `plugins/enjambre/`. Se edita el original de aquí, se copia encima y `npm test` comprueba que son idénticas.

## Workflows de GitHub Actions

Las plantillas de CI y de los workflows de agentes están en la skill `ci-cd`: `plugins/enjambre/skills/ci-cd/workflows/` (viajan con el plugin). Cómo usarlas, qué secretos crea Álvaro y sus límites en GitHub Free: [`SKILL.md`](../plugins/enjambre/skills/ci-cd/SKILL.md) y [ADR 0005](../docs/decisiones/0005-cierre-f1-y-ci-cd.md).

## `settings.proyecto.json` → `.claude/settings.json` del proyecto

1. Cópiala al repo del proyecto como `.claude/settings.json`. Si ya existe uno, combínalos.
2. Ajusta los comandos de `allow` a los scripts reales del proyecto. La lista actual está pensada para lobby.
3. Instala el plugin una vez por máquina, desde la carpeta del proyecto:
   `claude plugin install enjambre@enjambre --scope project`.
   El marketplace es el repo público `AlvaroM99/enjambre-publico`, así que no hacen falta credenciales.
4. La plantilla activa también `context7` y `playwright` del marketplace oficial de Anthropic (documentación actual de bibliotecas y navegador para pruebas). Quítalos si el proyecto no los necesita.

Las reglas `deny` son solo una primera capa. Según la documentación de permisos, no son una barrera de seguridad: un script puede abrir ficheros por su cuenta. Las barreras reales son los hooks del plugin (`plugins/enjambre/hooks`) y el sandbox del devcontainer.

## `devcontainer/` → `.devcontainer/` del proyecto

- Imagen con Node 24, Chrome para Playwright, Claude Code fijado a una versión, y `bubblewrap` y `socat` para el sandbox.
- `managed-settings.json` va a `/etc/claude-code/` y tiene la máxima prioridad. Hace tres cosas:
  - deja el sandbox obligatorio (`failIfUnavailable`);
  - quita el modo bypass;
  - limita la red de los comandos a npm, GitHub y Cloudflare.
- La configuración de Claude dentro del contenedor vive en un volumen (`/home/node/.claude`). No se montan `~/.ssh` ni credenciales del anfitrión.
- **Sandbox y seccomp (comprobado el 21-11-2026 con Docker Desktop 29.1.5):** con el perfil seccomp por defecto de Docker, bubblewrap no puede crear espacios de nombres, y el sandbox no arrancaría (con `failIfUnavailable`, Claude Code se negaría a ejecutar comandos). Por eso `devcontainer.json` lleva `--security-opt seccomp=unconfined`: así bubblewrap funciona con `/proc` propio y no hace falta `enableWeakerNestedSandbox`. **Coste:** el contenedor queda menos aislado del kernel del anfitrión. **Pendiente (F5):** un perfil seccomp propio que solo permita `unshare` y `clone` de espacios de nombres.

**Secretos para las pruebas de lobby.** `prueba.mjs` lee `.dev.vars` y `datos/.clave-local`. Los agentes no pueden leer esos ficheros, porque el hook lo impide, pero el script sí los usa al ejecutarse. Si el proyecto se monta en el contenedor, esos ficheros quedan dentro del volumen de trabajo. Para el modo autónomo hará falta cambiar a datos y credenciales sintéticos (pendiente, F1).
