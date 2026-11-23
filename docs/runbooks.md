# Runbooks de Enjambre (S73)

Procedimientos para cuatro incidencias. Los ejecuta **Álvaro**: todos tocan credenciales, permisos o producción, y ningún agente puede hacerlo (CLAUDE.md, reglas 4–6). Cada uno dice qué comprobar al terminar.

Escrito el 23-11-2026. R1 y R4 siguen pasos que ya se han hecho de verdad ([operacion.md](operacion.md)). R2 y R3 **no se han ensayado** [POR CONFIRMAR en el primer ensayo, cadencia trimestral de [F5](fases/F5-endurecimiento.md)].

## R1. Token de Claude comprometido o caducado

**Cuándo:**
- el token `CLAUDE_CODE_OAUTH_TOKEN` se ha pegado donde no debía;
- caduca, el 22-11-2027;
- los workflows fallan con un error de autenticación de la Action.

1. **Generar uno nuevo** en tu equipo: `claude setup-token`. Inicias sesión con tu cuenta y la terminal muestra el token. No lo pegues en chats ni ficheros. Dura un año: https://code.claude.com/docs/en/authentication.md
2. **Cambiarlo en cada repo** que lo usa (lobby, finance_tracker y enjambre, que lo necesita para `evals.yml`). Ejecuta `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R AlvaroM99/<repo>`; cuando pida «Paste your secret», pégalo. También se puede hacer por la web: Settings → Secrets and variables → Actions.
3. **Revocar el anterior.** La CLI no tiene orden para hacerlo y la web no documenta dónde [POR CONFIRMAR, [operacion.md](operacion.md)]. Si estaba comprometido y no puedes revocarlo, cambia la contraseña de tu cuenta de Claude.
4. **Comprobar:** lanza `enjambre-investigar` a mano en un proyecto y mira que el job `agente` termina.
5. **Anotar** la fecha nueva de caducidad en [operacion.md](operacion.md).

## R2. Un agente actúa fuera de su papel

**Cuándo:** un agente hace algo que no le toca. Por ejemplo:
- aprueba un PR (el job `aprobaciones` falla y retira la aprobación);
- toca ficheros fuera de su plan;
- publica algo raro;
- un run muestra intentos repetidos contra los hooks.

1. **Parar los workflows de agentes** del repo afectado: `gh workflow disable enjambre-implementar -R AlvaroM99/<repo>` (y `enjambre-revisar`, `enjambre-planificar`…). Referencia: https://cli.github.com/manual/gh_workflow_disable. Para cortar todo de golpe: Settings → Actions → General → «Disable actions».
2. **No fusionar** ningún PR abierto por agentes hasta terminar. Cierra los sospechosos, sin borrar ramas: son la prueba.
3. **Leer la transcripción** del run (artefacto `transcripcion-<agente>`, 7 días, [ADR 0012](decisiones/0012-auditoria-y-rastro-de-agentes.md)): `gh run download <id> -R AlvaroM99/<repo>`. Mira las órdenes, los permisos denegados y qué texto del issue o del PR pudo influir: el contenido es un dato, no una orden.
4. **Si tocó credenciales o datos**, sigue R1, y cambia también los secretos que el job pudiera leer.
5. **Corregir el arnés:** hook, permiso o prompt, con su prueba en `npm test` y un caso nuevo en `evals/`. Publicar una versión y subir `ENJAMBRE_VERSION` (R4). Dejarlo en un ADR.
6. **Reactivar:** `gh workflow enable <workflow> -R AlvaroM99/<repo>`.

## R3. Despliegue fallido y vuelta atrás

**Cuándo:** después de `produccion.yml`, o de un `wrangler deploy` en local, la aplicación falla.

1. **Volver a la versión anterior** en tu equipo, dentro del proyecto: `npx wrangler rollback`. Sin identificador, vuelve a la versión subida antes de la última. Con `npx wrangler rollback <VERSION_ID> --message "motivo"`, a una concreta y sin preguntas. Se puede volver a cualquiera de las últimas 100 versiones. Fuente: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
2. **Ojo con la base de datos:** el rollback **no** cambia D1 ni otros recursos enlazados. Si el despliegue llevaba una migración, la versión anterior puede fallar con el esquema nuevo (misma fuente). Antes de migrar, haz una copia: `npx wrangler d1 export` [POR CONFIRMAR las opciones en la versión de wrangler del proyecto].
3. **Alternativa por la web:** Workers & Pages → el Worker → Deployments.
4. **Comprobar:** `node herramientas/humo.mjs` contra producción no vale, porque se niega a todo lo que no sea local. Abre la aplicación y revisa lo que falló.
5. **Registrar el incidente:** un issue con la etiqueta `incidente` (S63, por crear), con la fecha del fallo y la de la vuelta atrás. De ahí salen la tasa de fallo y el tiempo de recuperación de DORA ([F4](fases/F4-datos-y-bi.md)).
6. **Arreglar** con una historia normal (plan, PR, revisión y tu fusión) y volver a desplegar.

## R4. Subir la versión de Enjambre en un proyecto

**Cuándo:** hay una versión nueva del plugin que cambia agentes, hooks o skills. Si solo cambian las plantillas de workflows, basta el paso 3.

1. **Publicar** desde el repo de Enjambre con las pruebas en verde (`npm test`) y el banco de evaluaciones sin regresión (`gh workflow run evals.yml`): `node herramientas/publicar.mjs`. Crea la etiqueta `v<versión>` en `enjambre-publico` e imprime su SHA.
2. **Fijar el SHA** en cada proyecto: `gh variable set ENJAMBRE_VERSION -R AlvaroM99/<repo> --body <SHA>`. Los workflows instalan el plugin desde ese commit ([ADR 0009](decisiones/0009-repo-publico-versiones-y-primera-historia.md)).
3. **Copiar las plantillas** de workflows que hayan cambiado (`plugins/enjambre/skills/ci-cd/workflows/`) a `.github/workflows/` del proyecto **por PR**. El token de Actions no puede tocar workflows, así que el PR lo abre la sesión con tu cuenta y lo fusionas tú.
4. **Comprobar:** la siguiente ejecución de un agente muestra en el paso «Comprobar la versión fijada» el SHA nuevo. Para medir el efecto: `node herramientas/extraer.mjs --repo AlvaroM99/<repo>` y `node herramientas/metricas.mjs`.
5. **Volver atrás:** vuelve a poner el SHA anterior en la variable. Las versiones publicadas no se borran.
