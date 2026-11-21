# Enjambre: contexto para Claude Code

Plugin y documentación de un equipo de agentes de Claude para desarrollo de software. Plan en [docs/PLAN.md](docs/PLAN.md). Las decisiones de [docs/decisiones/](docs/decisiones/) prevalecen sobre el plan.

## Reglas

1. Español de España, claro y llano, en la documentación. Commits en inglés (Conventional Commits) y sin líneas de atribución a Claude.
2. **Datos reales nunca al repositorio.** Este repo no contiene secretos, tokens, ID de bases de datos ni datos personales.
3. **No inventar:** las afirmaciones técnicas citan fuente (URL o fichero:línea). Lo no comprobado se marca [POR CONFIRMAR].
4. **Mínimo privilegio:** ningún agente despliega a producción, fusiona en `main` ni lee `.env`, `.dev.vars` o `datos/`.
5. Los cambios en agentes, hooks o permisos los aprueba Álvaro.
6. No crear cuentas, repos ni infraestructura sin que Álvaro lo pida.
