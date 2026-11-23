# ADR 0015: panel en vivo del enjambre en Cloudflare

- Estado: **aceptada** (Álvaro, 23-11-2026). En marcha desde el 23-11-2026: desplegado, con la GitHub App y los secretos de Álvaro. Comprobado con una historia real (finance_tracker#16) ([docs/panel.md](../panel.md))
- Fecha: 23-11-2026
- Sustituye en parte a: P13 del [plan](../PLAN.md) (panel dentro de lobby) y adelanta S34

## Contexto

Álvaro quiere una webapp en Cloudflare que:

- muestre de forma fiel y en tiempo real a los agentes trabajando en paralelo, sobre varias issues y PR de varios repositorios;
- permita poner y quitar etiquetas en las issues;
- permita leer, aprobar y fusionar los PR.

Decisiones ya tomadas por Álvaro (23-11-2026):

1. **Entrada con GitHub.** Solo entra `AlvaroM99`. Las acciones salen a su nombre, sin un token permanente guardado.
2. **Tiempo real por fases.** Fase 1 con lo que sabe GitHub. Fase 2, aparte y con su aprobación: cada herramienta que usa el agente.
3. **El código vive en `panel/`, dentro de este repo.** Sin repo nuevo.

Hoy no hay ningún PR abierto ni ningún agente trabajando: lobby#9 y todas las PR de v0.6.5 están fusionadas ([ADR 0014](0014-revision-automatica.md)).

## Decisión

### Arquitectura

```
GitHub (lobby, finance_tracker, enjambre)
  │  webhooks firmados (HMAC SHA-256)
  ▼
Worker «enjambre-panel» ──── Durable Object «Sala» (SQLite: estado, sesiones, últimos eventos)
  │  HTML/CSS/JS estáticos            │  WebSocket con hibernación → navegador
  ▼                                   ▼
Navegador de Álvaro  ◄──────── cambios al instante
  │  etiquetar · aprobar · fusionar (con su token de usuario)
  ▼
API de GitHub
```

- **Worker con recursos estáticos** y un único **Durable Object con SQLite**. Están disponibles en el plan gratuito: 1 GB por objeto y 5 GB por cuenta ([límites](https://developers.cloudflare.com/durable-objects/platform/limits/)).
- **GitHub App** (no OAuth App). Una sola app sirve para:
  - el login: token de usuario que actúa como Álvaro, pero limitado a los repos donde está instalada y a los permisos de la app ([docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app));
  - **un solo webhook** para todos los repos instalados.

  Con una OAuth App habría que pedir `repo`, que da acceso a todos sus repos privados, y crear un webhook en cada repo. Esto incumple el mínimo privilegio (regla 4 del `CLAUDE.md`).
- **Permisos de la app:**

  | Permiso | Acceso | Para qué |
  |---|---|---|
  | Issues | escritura | Etiquetas |
  | Pull requests | escritura | Aprobar |
  | Contents | escritura | Fusionar |
  | Actions, Checks, Commit statuses | lectura | |
  | Metadata | lectura | |

  **Eventos:** `issues`, `issue_comment`, `label`, `pull_request`, `pull_request_review`, `workflow_run`, `workflow_job`, `check_run`, `status`.
- **Instalada solo en** lobby, finance_tracker y enjambre. Un repo nuevo se añade instalándola en él; el panel lo muestra sin tocar código.

### Qué muestra (fase 1)

| Vista | Contenido | Fuente |
|---|---|---|
| **Agentes ahora** | Una tarjeta por ejecución en curso: agente, repo, issue o PR, job, paso actual y tiempo transcurrido. | `workflow_run` y `workflow_job`. Mientras hay jobs en curso y el panel está abierto, se consultan los pasos cada 10 s (GitHub no envía un evento por paso) |
| **Tablero de issues** | Columnas por etiqueta `enjambre:*`: propuesta → planificar → implementar/en-curso → revisar → hecho, con filtro por repo | `issues` y `label` |
| **PR** | Borrador o listo, estado `ci (Enjambre)` y checks, veredictos de revisor y seguridad, y revisión pedida | `pull_request`, `status`, `check_run`, comentarios |
| **Cronología** | Últimos 500 eventos de todos los repos | Todos |
| **Salud** | WebSocket conectado, hora del último webhook, y si el estado coincide con GitHub en la última conciliación | Propia |

**Agente según el job:**

| Workflow | Agente por job |
|---|---|
| `enjambre-planificar` | jefe de proyecto |
| `enjambre-implementar/implementar` | implementador |
| `enjambre-revisar` | `revisor` → revisor; `seguridad` → seguridad; `listo` → paso automático |
| `enjambre-analizar` | analista |
| `enjambre-investigar` | investigador |
| `enjambre-gobernanza` | gobernanza |
| `ci` | CI |

**Fidelidad.** Los webhooks pueden perderse. Al abrir el panel, y cada 5 min mientras está abierto, una **conciliación** relee de la API las issues y los PR abiertos y las ejecuciones en curso, y corrige el estado. Si un dato no viene de GitHub, el panel no lo inventa: lo que no sabe lo muestra como «sin datos».

### Acciones

| Acción | Cómo | Salvaguarda |
|---|---|---|
| Poner o quitar etiqueta | `POST /repos/{r}/issues/{n}/labels` y `DELETE` | Solo etiquetas que ya existen en el repo |
| Leer un PR | Descripción, ficheros con su diff, comentarios, veredictos y checks | Todo se pinta como texto; nunca `innerHTML` |
| Aprobar | Reseña `APPROVE` con comentario opcional | Solo PR de otros autores; GitHub no deja aprobar un PR propio |
| Fusionar | `PUT /pulls/{n}/merge`, squash por defecto, con `sha` igual a la cabeza que estás viendo | Si llega un commit nuevo, GitHub rechaza la fusión. El botón exige confirmar en la página y avisa si la CI no está en verde |

Ninguna acción la hace un agente: todas salen de un clic de Álvaro con su token. Es coherente con el [ADR 0011](0011-solo-alvaro-aprueba.md). Los workflows siguen sin fusionar ni aprobar.

### Seguridad

- **Entrada:**
  - solo el login de la lista `PROPIETARIOS = "AlvaroM99"`;
  - cookie de sesión `HttpOnly`, `Secure` y `SameSite=Strict`;
  - el token de usuario se guarda **cifrado** (AES-GCM, con clave en un secreto del Worker) en el Durable Object;
  - el token caduca a las 8 h y se renueva con su refresh token.
- **Escrituras:** comprobación de `Origin` y una cabecera anti-CSRF por sesión.
- **Webhook:**
  - firma `X-Hub-Signature-256` comprobada en tiempo constante ([docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries));
  - descarte de entregas repetidas por `X-GitHub-Delivery`;
  - se rechaza cualquier repo fuera de la instalación.
- **Navegador:** CSP estricta sin scripts externos. El contenido de issues y PR se trata como texto.
- **Secretos** (los pone Álvaro con `wrangler secret put`; nunca pasan por el repo ni por la sesión): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `WEBHOOK_SECRET` y `CLAVE_SESION`. El Client ID no es secreto, pero así no queda ningún identificador en el repo. `PROPIETARIOS` va en `wrangler.toml`.
- **Código público.** `publicar.mjs` copia todo el repo, así que `panel/` saldrá en enjambre-publico como el resto. No contiene secretos y `revisarContenido` bloquea tokens y claves.

### Código y pruebas

```
panel/
  wrangler.toml          # nombre enjambre-panel, Durable Object Sala (SQLite), assets
  src/index.js           # reparte entre estáticos y la Sala
  src/cabeceras.js       # CSP y cabeceras de seguridad
  src/sesion.js          # cookie, cifrado AES-GCM del token, CSRF, lista de propietarios
  src/sala.js            # Durable Object: rutas /login /callback /salir /webhook /ws /api/*, WebSocket, alarma
  src/github.js          # cliente mínimo de la API (fetch), firma del webhook
  src/estado.js          # reductor puro: evento de GitHub → estado del panel
  public/index.html      # una página: agentes, tablero, PR, cronología
  public/panel.js, panel.css
pruebas/panel-*.test.mjs # firma, reductor, rutas con fetch simulado, seguridad (CSRF, lista de propietarios)
```

JavaScript ESM sin framework, igual que lobby. La prueba e2e local usa `wrangler dev --port 8790` (**nunca** el 8787 de tu lobby), un GitHub falso en localhost y webhooks sintéticos firmados, con Playwright.

## Plan de trabajo

| # | Paso | Quién |
|---|---|---|
| 1 | Esqueleto, reductor de eventos y pruebas | Claude |
| 2 | Webhook firmado, Durable Object y WebSocket; vista «Agentes ahora» y cronología | Claude |
| 3 | Login con la GitHub App y sesión cifrada | Claude |
| 4 | Tablero de issues con etiquetas; vista de PR con aprobar y fusionar | Claude |
| 5 | Conciliación, alarma de pasos y vista de salud | Claude |
| 6 | e2e local completo con datos sintéticos | Claude |
| 7 | Crear la GitHub App con la lista exacta de campos que te daré. Instalarla en los 3 repos. Poner los 3 secretos | **Álvaro** |
| 8 | `wrangler deploy` (lo ejecutas tú o me dices que lo haga) y comprobar con una historia real en paralelo en lobby y finance_tracker | **Álvaro** + Claude |

**Talla:** L. Del paso 1 al 6, una sesión larga.

**Coste:** 0 € en el plan gratuito de Workers y Durable Objects [POR CONFIRMAR con el uso real].

## Resultado (23-11-2026)

- `pruebas/panel.test.mjs`: 32 pruebas del reductor, la firma, la sesión y la Sala con un GitHub simulado. El repo pasa de 372 a 404 pruebas.
- e2e con `npm run e2e` en `panel/`: 25 de 25. La recorre un GitHub falso en `:8791` con `wrangler dev` en `:8790` y Chrome, todo con datos sintéticos:
  - login;
  - conciliación inicial de dos repos;
  - dos agentes a la vez en dos repos, con el paso en vivo por webhook y por consulta;
  - poner y quitar etiquetas;
  - diff del PR, aprobar y fusionar atado al SHA;
  - un borrador no se fusiona;
  - firma falsa y falta de sesión rechazadas;
  - sin scroll horizontal en móvil ni errores en la consola.
- **Lección del e2e en Windows:** `wrangler dev` lanzado con `npx` deja `workerd` vivo si solo se mata el proceso padre. La prueba mata el árbol entero (`taskkill /t`) y se niega a empezar si el 8790 está ocupado.
- **Despliegue (23-11-2026):** `wrangler deploy` en la cuenta de Álvaro, a petición suya. Sin configurar, el Worker responde así:
  - la página: 200, con CSP, HSTS y `X-Frame-Options`;
  - `/api/yo`: «nadie»;
  - `/api/estado`: 401;
  - `/login`: avisa de que faltan los secretos;
  - `/webhook`: rechaza todo hasta tener `WEBHOOK_SECRET`.
- **Puesta en marcha (23-11-2026, 16:54–17:05 UTC):**
  - **Primer login:** falló con `incorrect_client_credentials`. Se había puesto como client secret la huella de la clave privada. El panel ahora dice la causa en vez de «Error interno».
  - **Con el client secret correcto:** Álvaro entró y puso una etiqueta en finance_tracker#16 desde el panel. Arrancó `enjambre-analizar`.
  - **Webhooks:** en el primer minuto llegaron 133, todos con 200. Incluían `check_run`: GitHub sí los entrega a una app que solo lee checks.
- **Sin comprobar** [POR CONFIRMAR]: el límite real de subpeticiones del plan gratuito. La conciliación gasta como mucho 40 peticiones por tic y concilia un repo cada vez.

## Ampliación: el flujo entero desde el panel (23-11-2026)

**Petición de Álvaro.** Quiere llevar una issue hasta el PR fusionado sin ir a GitHub. GitHub solo se ve a través de enlaces.

**Qué falló.** En finance_tracker#16, poner etiquetas a mano (planificar, implementar, revisar, analizar) no llevó a ningún PR, por tres motivos:

- **Implementar antes que el plan.** `enjambre:implementar` y `enjambre:planificar` se pusieron a la vez (13:50:56 UTC), así que el implementador arrancó sin plan, dijo «no hay plan» y paró. El plan llegó a las 13:54.
- **Etiqueta ya puesta.** `implementar` siguió en la issue. Los workflows arrancan con el evento `labeled` (`enjambre-implementar.yml`, `on.issues.types: [labeled]`), y el panel no ofrecía poner una etiqueta que ya estaba.
- **Etiqueta equivocada.** `enjambre:revisar` en una issue no hace nada: `enjambre-revisar.yml` escucha `pull_request`.

**Cambios** (sin tocar agentes, hooks ni permisos):

- **Cajón de la issue:**
  - descripción y comentarios en markdown seguro;
  - el plan marcado;
  - el flujo en 4 pasos;
  - los PR de la issue.
- **Botones** `POST /api/accion`:
  - `planificar`, `analizar` e `implementar` en una issue; `revisar` en un PR;
  - cada uno quita y vuelve a poner la etiqueta para que salte el evento, y antes quita las que sobran;
  - `implementar` exige un comentario «## Plan» del bot o del propietario, el mismo criterio que el workflow, y que no haya `enjambre:en-curso`. Es la puerta 1, con confirmación en la página.
- **Tablero:**
  - las columnas salen de lo que pasa: agentes en marcha, plan, PR;
  - aviso «Plan listo: revísalo y apruébalo»;
  - última nota del agente en la tarjeta.
- **Estado:** guarda el plan y la última nota por issue, desde los webhooks `issue_comment` y la conciliación. La conciliación lee como mucho 6 issues por tanda, solo las que tienen una etiqueta de trabajo.
- **Pruebas:**
  - unitarias: 38 del panel, 410 en total;
  - e2e: 30 de 30, con el plan publicado, el aviso, la lectura y la aprobación desde el panel.

## Fase 2 (otro ADR, no incluida)

Un hook `PostToolUse` del plugin enviaría al panel cada herramienta que usa el agente: nombre de la herramienta, agente, repo y número, **sin** argumentos ni contenido. Usaría un token por repo. Cambia hooks y workflows, así que se propone aparte cuando la fase 1 esté en uso.

## Consecuencias

- Puedes etiquetar, aprobar y fusionar sin salir del panel. GitHub sigue siendo la fuente de verdad: el panel no guarda nada que no pueda reconstruir.
- Hay una superficie nueva con poder de fusión. Se mitiga con la lista de propietarios, la cookie estricta, el token cifrado y limitado por la App, la fusión atada al SHA y la confirmación en la página.
- P13 deja de apuntar a lobby: el panel es una app propia. Las métricas de F4 (S34) se pueden añadir después como otra vista.
