---
name: planificar
description: Cómo refinar un issue o una épica de Enjambre en historias pequeñas y escribir su plan técnico (criterios Dado/Cuando/Entonces, ficheros, pruebas, riesgos, estimación) y, si hace falta, un ADR. Úsala al planificar una historia antes de implementarla.
---

# Planificar una historia

El plan es el contrato entre Álvaro, el implementador y el verificador. Un buen plan se puede ejecutar sin preguntar y se puede comprobar criterio a criterio.

## Pasos

1. **Lee la petición** (`gh issue view <n> --comments`) y separa lo que pide de lo que supone.
2. **Lee el contexto**: `CLAUDE.md`, documentos de área (`docs/<area>/CONTEXTO.md` o equivalentes), ADR en `docs/decisiones/` y el código que se va a tocar. Anota `fichero:línea` de todo lo que uses.
3. **Divide** si hace falta. Cada historia cumple INVEST:
   - **I**ndependiente: se puede fusionar sola;
   - **N**egociable: describe el resultado, no la implementación al detalle;
   - **V**aliosa: cambia algo que Álvaro nota;
   - **E**stimable: sabes qué ficheros toca;
   - **S**mall: S o M, y un PR de menos de 400 líneas;
   - **T**estable: cada criterio se comprueba ejecutando algo.
4. **Escribe los criterios** en Dado / Cuando / Entonces (ver abajo).
5. **Rellena la plantilla** `plantilla-plan.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-plan.md`).
6. **Repasa** con la lista de comprobación del final antes de entregar.

## Criterios de aceptación

Formato: **Dado** <estado inicial>, **cuando** <acción>, **entonces** <resultado observable>.

| Mal | Bien |
|---|---|
| «La lista funciona mejor» | «Dado un usuario con 30 tareas, cuando abre `/#/tareas`, entonces ve las 30 sin error en la consola» |
| «Se valida el formulario» | «Dado el formulario de tarea vacío, cuando pulsa Guardar, entonces aparece "El título es obligatorio" y no se crea ninguna tarea» |
| «Es rápido» | «Dado 500 registros, cuando se carga la página, entonces la respuesta de `/api/c/tareas` tarda menos de 300 ms en local» |

- Un criterio por comportamiento. Incluye al menos un caso de error o límite.
- Nada que solo se pueda comprobar leyendo el código.

## Estimación

| Talla | Orientación |
|---|---|
| S | 1–3 ficheros, sin cambio de esquema, < 150 líneas |
| M | hasta ~8 ficheros o una migración sencilla, < 400 líneas |
| L | más que eso: **dividir** antes de pasar a Listo |

Marca `complejidad: alta` si toca autenticación, migraciones de datos, seguridad o varias capas a la vez.

## ADR

Escribe un ADR cuando la decisión:
- afecta a más de un área o a la arquitectura;
- cambia una dependencia, un servicio externo o el modelo de datos;
- descarta una alternativa razonable que alguien podría volver a proponer.

Usa `plantilla-adr.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-adr.md`). Nombre del fichero: el que use el proyecto (en Enjambre, `docs/decisiones/NNNN-titulo.md`; en finance_tracker, `docs/decisiones/AAAA-MM-DD-titulo.md`). El ADR nace en estado **Propuesta**; lo acepta Álvaro.

## Lista de comprobación del plan

- [ ] Cada criterio es Dado/Cuando/Entonces y comprobable ejecutando algo
- [ ] Hay al menos un criterio de error o límite
- [ ] Los ficheros afectados existen (o se dice que son nuevos)
- [ ] Cada criterio tiene una prueba asignada
- [ ] Estimación S o M
- [ ] Riesgos con mitigación
- [ ] Cada afirmación técnica cita su fuente o está marcada [POR CONFIRMAR]
- [ ] Las preguntas abiertas están en «Preguntas para Álvaro»
