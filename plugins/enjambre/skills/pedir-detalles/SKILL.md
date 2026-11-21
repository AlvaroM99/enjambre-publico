---
name: pedir-detalles
description: Cuándo y cómo pedir detalles a Álvaro antes de planificar o implementar - distinguir lo que hay que preguntar de lo que se puede suponer, formular pocas preguntas cerradas con una propuesta por defecto y dejar el trabajo en espera con la etiqueta necesita-humano. Úsala cuando una petición, un plan o un hallazgo es ambiguo o incompleto.
---

# Pedir detalles

Preguntar cuesta una espera; suponer mal cuesta un PR tirado. Esta skill decide cuál de las dos cosas hacer y cómo hacerla bien.

## 1. ¿Preguntar o suponer?

Antes de preguntar, busca la respuesta tú: `CLAUDE.md`, `docs/`, ADR en `docs/decisiones/`, el código, el historial (`git log`), issues y PR anteriores (`gh issue list --search`, `gh pr list --search`).

| Situación | Qué haces |
|---|---|
| La respuesta está en el repo o en un issue | No preguntes. Cita `fichero:línea` o el enlace. |
| Hay una convención clara en el código | Síguela y dilo en el plan: «Sigo el patrón de `src/x.js:40`». |
| La duda cambia poco y se deshace fácil (nombre, texto, orden) | Supón lo razonable y márcalo **[SUPUESTO]** en el plan o el PR. |
| La duda cambia el alcance, el diseño, los datos, la seguridad, el coste o algo visible para usuarios | **Pregunta y para.** |
| La petición contradice una regla o un ADR | **Pregunta y para.** Cita la regla. |
| Necesitarías un secreto, un dato real o un acceso nuevo | **No lo pidas.** Dilo: lo gestiona Álvaro fuera del agente. |

Regla corta: pregunta si una respuesta distinta cambiaría el plan **y** no puedes deducirla del repositorio.

## 2. Cómo se pregunta

- **Pocas preguntas**: de 1 a 5. Si salen más, la historia no está lista: propón partirla.
- **Cerradas y con opciones**: Álvaro tiene que poder contestar con una letra.
- **Con tu propuesta por defecto** y qué pasa si no contesta.
- **Con el porqué**: una línea de impacto por pregunta.
- **Ordenadas** por lo que más bloquea.

Formato (comentario en el issue o en el PR, o en tu respuesta final si no puedes comentar):

```markdown
## Preguntas antes de seguir

| # | Pregunta | Opciones | Mi propuesta | Si no contestas |
|---|---|---|---|---|
| 1 | ¿El filtro por etiqueta distingue mayúsculas? | a) sí · b) no | b) no | sigo con b) |
| 2 | ¿Se puede añadir la dependencia `zod` (≈ 60 kB)? | a) sí · b) validación a mano | a) sí | **no sigo**: dependencia nueva |

Supuestos que he tomado: [SUPUESTO] el texto del botón es «Filtrar».
```

Marca **«no sigo»** las preguntas que bloquean de verdad (dependencias nuevas, datos, seguridad, coste, alcance). Las demás llevan una propuesta que se aplica si no hay respuesta.

## 3. Después de preguntar

1. Añade la etiqueta `necesita-humano` si alguna pregunta bloquea (`gh issue edit <n> --add-label necesita-humano`, si te lo permiten).
2. **Para.** No empieces la parte bloqueada «por adelantar». Puedes avanzar lo que no depende de la respuesta solo si el plan lo separa claramente.
3. Cuando llegue la respuesta, cítala en el plan («Respuesta de Álvaro en el issue, 21-11-2026: b»).

## Lo que no se hace

- Preguntar lo que está en el repositorio.
- Preguntas abiertas del tipo «¿cómo lo quieres?».
- Pedir permiso para saltarse una regla de Enjambre: las reglas no se negocian dentro de una tarea.
- Seguir adelante con un supuesto en algo que la tabla de arriba marca como «pregunta y para».

## Fuentes

- Buenas prácticas de Claude Code (dar contexto, pedir aclaraciones antes de implementar): https://code.claude.com/docs/en/best-practices
- Definición de listo y criterios comprobables: skill `planificar` y `docs/anexos/D-backlog.md`.
