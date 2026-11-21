---
name: tomar-decisiones
description: Método de Enjambre para elegir entre alternativas técnicas (librería, diseño, patrón, herramienta, servicio) - encuadrar la decisión, valorar si es reversible, comparar al menos dos opciones con criterios ponderados y evidencias citadas, recomendar una y dejarla registrada en el plan, el PR o un ADR. Úsala cuando haya más de una forma razonable de hacer algo.
---

# Tomar decisiones técnicas

Una buena decisión se puede explicar en un párrafo, cita sus fuentes y dice qué haría falta para cambiarla.

## 1. Encuadra

Escribe en una frase **qué se decide** y **por qué ahora**. Ejemplo: «Cómo validar el cuerpo de las peticiones de la API de lobby, porque la historia #14 añade tres rutas nuevas».

## 2. ¿Quién decide?

| Tipo de decisión | Ejemplos | Decide |
|---|---|---|
| **Reversible y local** (se deshace en un PR, afecta a pocos ficheros) | nombre de una función, estructura interna de un módulo | el agente, y lo explica en el PR |
| **Reversible pero visible** | formato de una respuesta de la API, texto de la interfaz | el jefe de proyecto en el plan; Álvaro lo aprueba con el plan |
| **Difícil de deshacer** | esquema de base de datos, dependencia de producción, servicio externo, formato de datos guardados, permisos o seguridad, coste recurrente | **Álvaro**, con ADR |

Ante la duda, trátala como difícil de deshacer.

## 3. Opciones

- Al menos **dos** opciones reales, y la opción **«no hacer nada / lo mínimo»** cuando tenga sentido.
- Parte de lo que ya usa el proyecto y de la skill `referencias-estandar`. Una dependencia nueva tiene que ganar claramente a lo que ya hay.
- Para cada opción: qué es, una fuente (URL de la documentación oficial o `fichero:línea`) y qué supone para este proyecto.

## 4. Compara

Tabla ponderada, con los criterios que importan **en esta decisión** (entre 3 y 6), pesos que sumen 100 % y puntuación de 1 a 5 (5 = mejor):

| Criterio | Peso | Opción A | Opción B | Mínimo |
|---|---|---|---|---|
| Encaje con el stack actual | 30 % | 5 | 3 | 4 |
| Mantenimiento y seguridad | 25 % | 4 | 4 | 5 |
| Coste (dinero, tamaño, minutos de CI) | 20 % | 4 | 2 | 5 |
| Facilidad de deshacer | 25 % | 4 | 2 | 5 |
| **Total** | 100 % | **4,3** | 2,8 | 4,7 |

Criterios habituales: corrección, seguridad, coste, rendimiento, mantenimiento (última versión, comunidad, licencia), encaje con el stack, facilidad de prueba, facilidad de deshacer, tiempo de implementación.

La tabla ayuda a pensar; **no decide sola**. Si el resultado choca con tu intuición, busca el criterio que falta.

## 5. Recomienda y registra

```markdown
### Decisión: <qué>
- **Recomiendo:** opción X.
- **Por qué:** 2–3 razones con su fuente.
- **Ganamos / perdemos:** …
- **Reversible:** sí/no; cómo se volvería atrás.
- **Revisar si:** la condición que haría cambiarla (p. ej. «más de 10 rutas», «la librería deja de publicar versiones»).
- **Decide:** agente / jefe en el plan / Álvaro con ADR.
```

- Decisiones locales: en la descripción del PR.
- Decisiones del plan: en el plan, sección «Decisiones».
- Decisiones difíciles de deshacer: ADR con la plantilla de la skill `planificar` (`docs/decisiones/NNNN-titulo.md`).

## Errores que se evitan

- Elegir por popularidad sin mirar el encaje con el proyecto.
- Comparar una opción detallada con otras de paja.
- Decidir algo irreversible dentro de un PR sin ADR.
- Citar memoria en lugar de documentación: si no puedes comprobarlo, **[POR CONFIRMAR]**.

## Fuentes

- Registro de decisiones (ADR) y formato MADR: https://adr.github.io/ y https://adr.github.io/madr/
- Tabla ponderada aplicada en Enjambre: `docs/PLAN.md`, §4 (tabla comparativa de vías).
- Anthropic, «Building effective agents» (empezar por lo simple): https://www.anthropic.com/engineering/building-effective-agents
