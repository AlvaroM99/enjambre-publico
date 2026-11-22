# 0012. Auditoría de F1–F3, rastro de cada agente y plan de F4 y F5

- **Fecha:** 22-11-2026
- **Estado:** Aceptada (las decisiones D-F4 de F4 siguen abiertas)
- **Decide:** Álvaro

## Contexto

Álvaro pide tres cosas:
- revisar que las fases 1, 2 y 3 están bien implementadas;
- probar todo el sistema;
- empezar a planificar F4 (datos y BI) y F5 (endurecimiento continuo del arnés de los agentes).

## Decisión

1. **Auditoría** en [docs/auditoria-f1-f3.md](../auditoria-f1-f3.md):
   - F1 se cerró por decisión, con 1 historia real de 5.
   - F2 está cumplida.
   - F3 está cumplida en entregables, pero su criterio de salida necesita las métricas de F4.
   - En local, todo verde: 326 pruebas, plugin válido y banco de evaluaciones al 20/20 con el plugin `v0.4.2`.
2. **Prueba real** de los agentes que no se habían estrenado (lobby):

   | Agente | Turnos | Coste | Resultado |
   |---|---|---|---|
   | Analista (lobby#8) | 22 | 0,46 USD | Terminó, pero su informe no llegó al issue. 4 permisos denegados |
   | Investigador QA | 12 | 0,17 USD | Sin issues ni tabla. 2 permisos denegados |
   | Gobernanza | 41 | 0,52 USD | Falló por superar el límite de 20 turnos. Abrió 2 propuestas buenas (lobby#9 y #10); su informe se perdió. 12 permisos denegados |

3. **Todo agente deja rastro** (plantillas `v0.5.0`, [lobby#11](https://github.com/AlvaroM99/lobby/pull/11) y [finance_tracker#6](https://github.com/AlvaroM99/finance_tracker/pull/6)):
   - la transcripción de cada agente se guarda como artefacto del run durante 7 días;
   - el analista y el jefe tienen respaldo de respuesta en el issue;
   - QA y gobernanza tienen respaldo de su issue «Informe…»;
   - límites de turnos ajustados: gobernanza 45, analista y QA 35, jefe 30;
   - una prueba exige rastro y respaldo en todo workflow de agentes.
4. **Plan de F4** en [docs/fases/F4-datos-y-bi.md](../fases/F4-datos-y-bi.md):
   - métricas DORA (guía actual de cinco métricas), coste por historia, permisos denegados y pass@1;
   - estrella de hechos y dimensiones, `extraer.mjs`, dbt-duckdb en el runner y workflow diario;
   - panel en Lobby (recomendado);
   - cuatro decisiones para Álvaro (D-F4-1 a D-F4-4).
5. **Plan de F5** en [docs/fases/F5-endurecimiento.md](../fases/F5-endurecimiento.md):
   - ciclo medir → detectar → proponer → aprobar → publicar;
   - cadencias semanal, mensual, trimestral y anual;
   - seis líneas de trabajo y un primer trimestre;
   - estado de las mejoras M1–M17.

## Consecuencias

- Hasta fusionar lobby#11 y finance_tracker#6, un agente puede seguir terminando sin respuesta visible. Después se repiten analista, QA y gobernanza, y se ajusta `limitar-bash` con las transcripciones (S65).
- Backlog nuevo: épica E13 (F5) y las historias S60–S76.
- La segunda historia es lobby#8 (semilla sintética, M8). Su análisis se repetirá con rastro antes de planificarla.
