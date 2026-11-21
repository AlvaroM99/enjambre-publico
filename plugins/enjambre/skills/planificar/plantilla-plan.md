## Plan de Enjambre

**Historia:** #<issue> · <título>
**Estimación:** S | M  (si sale L, dividir antes de pasar a Listo)
**Complejidad:** normal | alta

### Objetivo
Qué cambia para quien usa el producto, en una o dos frases.

### Contexto
Qué hay hoy y por qué hace falta el cambio. Cada afirmación con su fuente (`fichero:línea` o URL). Lo no comprobado, marcado [POR CONFIRMAR].

### Criterios de aceptación
1. **Dado** <estado inicial>, **cuando** <acción>, **entonces** <resultado observable>.
2. **Dado** …, **cuando** …, **entonces** ….

Cada criterio debe poder comprobarlo el verificador ejecutando algo (prueba, navegador, API).

### Enfoque técnico
Pasos del implementador, en orden:
- [ ] Paso 1
- [ ] Paso 2

### Ficheros afectados
| Fichero | Cambio |
|---|---|
| `ruta/al/fichero` | qué se toca |

Fuera de alcance: lo que **no** se toca.

### Pruebas
- Nuevas: qué prueba cubre cada criterio.
- Existentes que deben seguir pasando: comandos (`npm run check`, …).

### Riesgos
| Riesgo | Mitigación |
|---|---|
| … | … |

### Dependencias y decisiones
- Dependencias: ninguna | #<issue>
- ADR necesario: no | sí (`docs/decisiones/AAAA-MM-DD-titulo.md`)

### Preguntas para Álvaro
Ninguna | lista. Si hay preguntas, la historia queda en `necesita-humano` y no pasa a Listo.

### Definición de listo
- [ ] Objetivo y criterios comprobables
- [ ] Plan técnico, ficheros y pruebas
- [ ] Estimación S o M
- [ ] Dependencias resueltas
- [ ] Aprobado por Álvaro
