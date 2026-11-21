---
name: investigar-estado-del-arte
description: Método de Enjambre para investigar antes de construir - analizar la petición, buscar en fuentes primarias el estándar tecnológico, bibliotecas y repositorios públicos reutilizables, alternativas y competencia, comparar construir, reutilizar o integrar y entregar un informe con fuentes. Úsala al empezar un proyecto o una funcionalidad grande, o antes de una dependencia o servicio importante.
---

# Investigar el estado del arte

La pregunta de partida siempre es: **¿alguien ya lo ha resuelto bien y lo podemos usar?** Ejemplo: para un editor de texto en una web, lo razonable es integrar un editor abierto y mantenido (CodeMirror, ProseMirror/Tiptap, Monaco, Lexical…) y dedicar el esfuerzo a lo que hace único al proyecto, no escribir otro editor.

## 1. Analiza la petición (antes de buscar nada)

| Pregunta | Ejemplo |
|---|---|
| ¿Qué problema y para quién? | «Álvaro quiere anotar recetas desde el móvil» |
| ¿Qué es lo esencial y qué es accesorio? | esencial: texto con formato; accesorio: colaboración en tiempo real |
| ¿Restricciones? | Cloudflare Workers + D1, plan gratuito, sin datos personales en terceros, licencia permisiva |
| ¿Qué ya hay en el repo? | `package.json`, ADR, componentes existentes |
| ¿Qué cuenta como éxito? | criterios medibles que luego usará el jefe de proyecto |

Si falta algo que cambia la recomendación, aplica la skill `pedir-detalles` y para.

## 2. Busca con método

Términos genéricos en inglés (más resultados) y sin datos privados del proyecto. Por cada categoría, al menos dos fuentes primarias:

| Categoría | Dónde buscar | Qué anotar |
|---|---|---|
| Estándar del dominio | documentación oficial, especificaciones (W3C, IETF, WHATWG), guías del proveedor (Cloudflare, MDN) | qué es lo habitual hoy y por qué |
| Bibliotecas y componentes | registro (npmjs.com, crates.io), repositorio, https://deps.dev | licencia, última versión y fecha, mantenimiento, tamaño, compatibilidad con Workers |
| Proyectos completos de código abierto | GitHub (búsqueda por tema, listas `awesome-*`), plantillas oficiales | qué resuelven, licencia, si se pueden usar como base o como referencia |
| Competencia y alternativas | webs de producto, documentación pública, comparativas con fecha | funciones, precio, qué no hacen, qué aprender |
| Servicios gestionados | página de precios y límites del plan gratuito | coste, dependencia, privacidad |

Reglas de fuentes:
- **Primarias primero.** Un blog o un resumen solo sirve para encontrar la fuente primaria.
- **Fecha en todo**: «12 300 estrellas a 21-11-2026». Las versiones no se escriben de memoria.
- Lo que no puedas comprobar: **[POR CONFIRMAR]**.
- Para ver la salud de un repositorio sin clonarlo: estrellas, fecha del último commit y de la última versión, issues abiertas frente a cerradas, licencia, número de mantenedores.

## 3. Construir, reutilizar o integrar

| Opción | Cuándo conviene |
|---|---|
| **Reutilizar** una biblioteca o componente | resuelve lo esencial, licencia permisiva, mantenida, encaja en el stack |
| **Partir de** un proyecto abierto (fork o plantilla) | cubre gran parte y el resto es adaptación; asumir su mantenimiento |
| **Integrar** un servicio | no es el núcleo del proyecto y el plan gratuito basta; vigilar privacidad y dependencia |
| **Construir** | es lo que diferencia al proyecto, o lo existente no encaja (licencia, tamaño, Workers) |

Compáralas con la tabla ponderada de la skill `tomar-decisiones` (criterios típicos: encaje, licencia, mantenimiento, coste, privacidad, esfuerzo, facilidad de salir).

## 4. Licencias (resumen operativo)

| Licencia | Uso en proyectos de Álvaro |
|---|---|
| MIT, Apache-2.0, BSD, ISC | sí, conservando el aviso de copyright |
| MPL-2.0 | sí; los cambios a esos ficheros se publican |
| LGPL | con cuidado (enlazado); consultar |
| GPL, AGPL | **no** sin decisión de Álvaro: obliga a publicar el código |
| Sin licencia | **no**: por defecto, todos los derechos reservados |

No es asesoramiento legal; ante la duda, ADR y decisión de Álvaro. Referencia: https://choosealicense.com/licenses/

## 5. Entrega

Informe con `plantilla-investigacion.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-investigacion.md`). Destino: `docs/investigacion/AAAA-MM-DD-tema.md` del proyecto. El jefe de proyecto lo cita en el plan; si la recomendación es difícil de deshacer, se convierte en ADR.

## Errores que se evitan

- Recomendar lo que el modelo «recuerda» sin comprobar que sigue vivo.
- Comparar solo opciones de construir.
- Ignorar el plan gratuito y los límites de Workers.
- Copiar código de un repositorio sin mirar su licencia.
