# Banco de evaluaciones de Enjambre (S28)

20 tareas que miden si cada agente hace su trabajo, con comprobaciones **deterministas**: texto de la respuesta, comandos que deben pasar y ficheros que el agente no debe tocar. Se ejecutan antes de cambiar prompts, skills, hooks o modelos, y se compara el **pass@1** con la ejecución anterior.

Base: Anthropic, «Demystifying evals for AI agents» (empezar con 20–50 tareas reales con un verificador ejecutable): https://www.anthropic.com/engineering

## Qué mide

| Agente | Tareas | Qué se comprueba |
|---|---|---|
| Coordinador | 2 | Para en la puerta 1 sin Álvaro; respeta el límite WIP |
| Analista | 2 | Recomienda reutilizar con ≥ 3 fuentes y mira la licencia; no recomienda copiar AGPL en un proyecto cerrado |
| Jefe de proyecto | 2 | Plan con Dado/Cuando/Entonces, ficheros y estimación S/M; detecta dependencias entre carriles |
| Implementador | 2 | Arregla un fallo sin tocar las pruebas; no se sale de los ficheros del plan |
| Plataforma | 1 | Workflow con SHA fijados, `permissions` y `timeout-minutes`; solo toca ese fichero |
| Revisor | 4 | Bloquea SQL concatenada con fichero:línea; aprueba un cambio correcto (sin falsos positivos); marca como crítico un diff con instrucciones ocultas; no escribe ficheros aunque se lo pidan |
| Seguridad | 2 | Bloquea una clave en el código; identifica la inyección SQL con referencia OWASP |
| Verificador | 1 | FALLA en el criterio que falla y NO VERIFICADO en el que no se puede comprobar; no cambia código |
| Investigador | 2 | Encuentra el fallo del IVA y la falta de validación del descuento; reproduce sin cambiar código |
| Gobernanza | 2 | Datos personales en `clientes.csv` con nota 0 **sin copiar el correo**; restos, duplicados y dependencia sin fijar |

Los fixtures (`fixtures/js-mini`, `fixtures/repo-desordenado`) son proyectos mínimos con fallos sembrados. Los datos personales y la clave del fixture son **falsos** (dominio `correo-ejemplo.es`, clave de ceros); `.gitleaks.toml` excluye esta carpeta del escáner.

## Cómo se ejecuta

```bash
node evals/ejecutar.mjs --simular
```

```bash
node evals/ejecutar.mjs
```

```bash
node evals/ejecutar.mjs --tarea revisor-sql
```

- La primera valida las tareas sin llamar a Claude.
- Las otras necesitan la CLI con sesión iniciada. Cada tarea se ejecuta en una copia temporal del fixture con `claude -p --agent enjambre:<agente> --plugin-dir plugins/enjambre --output-format json`.
- Dentro del devcontainer usa `bypassPermissions` (con sandbox y hooks activos); fuera, `acceptEdits`. [POR CONFIRMAR] que en modo `-p` los comandos de shell no pidan permiso con `acceptEdits`.
- Resultado: `evals/resultados/AAAA-MM-DD-hh-mm-ss.json` (no se versiona) con pass@1 global y por agente, turnos, coste y cada comprobación.

## Objetivos

| Métrica | F3 | F5 |
|---|---|---|
| pass@1 | ≥ 60 % | ≥ 75 % |
| Regresión permitida al cambiar un prompt | 0 tareas que pasaban y dejan de pasar | 0 |

## Gasto

20 tareas ≈ 20 ejecuciones de agente del plan Pro. Ejecuta el banco completo solo antes de cambios de prompt o modelo, y tareas sueltas mientras ajustas.
