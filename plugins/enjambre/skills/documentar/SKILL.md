---
name: documentar
description: Cómo mantener la documentación de un proyecto de Enjambre al día en el mismo PR que el cambio - qué documentos tocar, estilo en español de España, etiquetas de certeza y ADR. Úsala al implementar una historia o al revisar si un PR actualizó los docs afectados.
---

# Documentar en Enjambre

La documentación se actualiza **en el mismo PR** que el cambio, no después. Un PR que cambia comportamiento y no toca los docs afectados está incompleto (definición de hecho).

## Qué documento tocar

Busca primero cómo documenta el proyecto (`CLAUDE.md`, `README.md`, `docs/`). Patrón habitual (finance_tracker, lobby):

| Si el cambio… | Actualiza |
|---|---|
| cambia cómo se usa, instala o arranca | `README.md` |
| cambia comandos, reglas o convenciones para agentes | `CLAUDE.md` (< 200 líneas) |
| afecta a un área (frontend, backend, plataforma) | su documento de contexto (`docs/<area>/CONTEXTO.md`, `docs/frontend/FRONTEND_CONTEXT.md`…) |
| toma una decisión de arquitectura o entre áreas | un ADR nuevo (skill `planificar`) |
| cambia el estado de lo implementado o el roadmap | `docs/IMPLEMENTATION_STATUS.md`, `docs/ROADMAP.md` o equivalente |
| cambia la API o el formato de datos | la referencia de la API o el esquema |
| deja algo pendiente | marca [POR CONFIRMAR] o añade la tarea donde el proyecto registre pendientes |

Si un cambio no necesita docs (refactor interno, prueba), dilo en el PR: «Docs: no aplica, porque…».

## Estilo

- **Español de España**, claro y llano. Frases cortas. Voz activa.
- Primero lo que hay que hacer, después el porqué.
- Tablas y listas para lo que se compara o se enumera; prosa para explicar.
- Comandos en bloques de código, copiables tal cual.
- Fechas en formato DD-MM-AAAA en texto; AAAA-MM-DD en nombres de fichero.
- Sin datos reales, secretos, ID de bases de datos ni datos personales.

## No inventar

- Cada afirmación técnica cita su fuente (`fichero:línea`, comando o URL).
- Etiquetas de certeza cuando haga falta: **Confirmado**, **Documentado**, **Inferido**, **Propuesta**, **Pendiente**.
- Lo que no has comprobado: **[POR CONFIRMAR]**.
- Si encuentras un documento que contradice el código, no elijas en silencio: corrígelo citando el código o anótalo como conflicto.

## Al revisar (revisor)

- ¿El diff cambia comportamiento visible, comandos o configuración? Entonces debe tocar algún doc de la tabla.
- ¿Los docs nuevos o cambiados dicen la verdad respecto al código del PR?
- ¿Quedan referencias a nombres, rutas o comandos que el PR ha cambiado? (`grep` del nombre antiguo).
