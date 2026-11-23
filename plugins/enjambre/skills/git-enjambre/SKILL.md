---
name: git-enjambre
description: Flujo Git de Enjambre - ramas enjambre/clave-slug, commits Conventional Commits en inglés sin atribución, PR listo para revisión con la plantilla de Enjambre y lo que nunca se hace (push a main, force, merge). Úsala al crear ramas, hacer commits o abrir y actualizar PR.
---

# Git en Enjambre

GitHub flow: `main` siempre desplegable, ramas cortas (menos de 2 días) y todo entra por PR que fusiona Álvaro.

## Ramas

- Formato: `enjambre/<clave>-<slug>`. Ejemplos: `enjambre/42-filtro-tareas`, `enjambre/LOB-17-export-csv`.
  - `<clave>`: número del issue (o clave de Jira si algún día se usa).
  - `<slug>`: 2–4 palabras en minúsculas con guiones, sin tildes.
- Crear desde `main` actualizado:
  ```bash
  git switch main
  git pull --ff-only
  git switch -c enjambre/42-filtro-tareas
  ```
- Una rama por historia. No reutilices ramas de otras historias.

## Trabajo en paralelo (worktrees)

Puede haber hasta 6 historias en curso a la vez. Cada una vive en su **propio worktree**, para que dos implementadores no compartan carpeta:

- Si el agente se lanzó con `isolation: worktree`, ya estás en uno: `git worktree list` lo muestra. Crea la rama ahí.
- Si estás en la carpeta principal del repo y hay otras historias en curso, crea el worktree tú:
  ```bash
  git fetch origin main
  git worktree add ../<repo>-42 -b enjambre/42-filtro-tareas origin/main
  cd ../<repo>-42
  ```
- No toques ficheros de otra historia en curso. Si los necesitas, para: el jefe de proyecto tiene que poner esas historias en serie.
- Al terminar (PR abierto), el worktree se puede quitar con `git worktree remove ../<repo>-42` (la rama sigue en el remoto).
- Antes de pedir revisión, actualiza tu rama si `main` ha cambiado: `git fetch origin main && git rebase origin/main` **solo si la rama no está publicada**; si ya está publicada, `git merge origin/main` (nunca `push --force`).

## Commits

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), en inglés, en imperativo:

```
<type>(<scope opcional>): <description en minúsculas, sin punto final>

<body opcional: qué y por qué, no cómo>

Refs #42
```

| Tipo | Cuándo |
|---|---|
| `feat` | funcionalidad nueva |
| `fix` | corrección de un fallo |
| `test` | solo pruebas |
| `docs` | solo documentación |
| `refactor` | cambia código sin cambiar comportamiento |
| `chore` | mantenimiento, configuración |
| `ci` | workflows de CI |

Reglas:
- **Sin líneas de atribución** (`Co-Authored-By`, «Generated with…»). Si el proyecto lo pide, se permite el trailer `Enjambre-Agente: implementador`.
- Commits pequeños y coherentes: cada uno compila y pasa las pruebas.
- Añade los ficheros por nombre (`git add ruta/fichero`), no `git add -A`, para no subir nada por accidente.
- Antes de cada commit, mira `git diff --staged`: sin secretos, sin datos reales, sin ficheros ajenos al plan.

## Pull request

1. Comprueba el tamaño: `git diff main...HEAD --shortstat`. Menos de **400 líneas** cambiadas; si no, propón dividir.
2. Sube la rama: `git push -u origin enjambre/<clave>-<slug>`.
3. Escribe el cuerpo con `plantilla-pr.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-pr.md`) en un fichero temporal fuera del repo, o pásalo por la entrada estándar.
4. Ábrelo **listo para revisión** (sin `--draft`; Álvaro, 23-11-2026). La CI y la revisión de los agentes arrancan solas:
   ```bash
   gh pr create --title "feat: filter tasks by tag" --body-file - < cuerpo.md
   ```
   Título = primer commit o resumen, con formato Conventional Commits.
5. Tras una revisión con CAMBIOS: nuevos commits en la misma rama (sin reescribir historia) y un comentario que diga qué hallazgo resuelve cada uno.

## Nunca

| Prohibido | Motivo |
|---|---|
| `git push` a `main`/`master` o estando en `main` | todo entra por PR |
| `git push --force`, `-f`, `+rama` | reescribe historia ajena |
| `gh pr merge`, `gh pr review --approve` | fusionar y aprobar es de Álvaro |
| `git reset --hard`, `git clean -fd` sobre trabajo sin guardar | pérdida de datos |
| `--no-verify` | se salta comprobaciones |

El hook `bloquear-comandos` del plugin bloquea los más graves, pero la regla es no intentarlo.
