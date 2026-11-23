# Panel en vivo: puesta en marcha

El panel ([ADR 0015](decisiones/0015-panel-en-vivo.md)) muestra a los agentes trabajando en tus repos en tiempo real. Desde él puedes:

- poner y quitar etiquetas en las issues;
- leer los PR;
- aprobar y fusionar los PR.

El código está en [`panel/`](../panel/).

Esta guía es para Álvaro. Los secretos los pones tú: nunca pasan por el repo ni por la sesión de Claude.

## 1. Desplegar el Worker (una vez)

**Hecho el 23-11-2026.** Lo desplegó Claude a petición de Álvaro, en su cuenta de Cloudflare. La URL no se apunta en el repo, porque el repo se publica: es `enjambre-panel.<subdominio>.workers.dev`.

```
cd panel
npm install
npx wrangler deploy
```

`wrangler deploy` imprime la URL, por ejemplo `https://enjambre-panel.<tu-subdominio>.workers.dev`. Apúntala.

Hasta el paso 3, la página dice «El panel aún no está configurado». Es lo esperado.

## 2. Crear la GitHub App

En GitHub: **Settings → Developer settings → GitHub Apps → New GitHub App**.

| Campo | Valor |
|---|---|
| GitHub App name | `enjambre-panel-alvaro` (tiene que ser único en GitHub) |
| Homepage URL | la URL del paso 1 |
| Callback URL | `<URL>/callback` |
| Expire user authorization tokens | marcado (los tokens caducan a las 8 h y el panel los renueva) |
| Request user authorization (OAuth) during installation | sin marcar |
| Webhook → Active | marcado |
| Webhook URL | `<URL>/webhook` |
| Webhook secret | uno nuevo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Guárdalo para el paso 3 |
| Where can this GitHub App be installed? | **Only on this account** |

**Ojo con el client secret:** no es la clave privada (`.pem`) ni su huella SHA. Si pones la huella, el login falla con `incorrect_client_credentials`, que es lo que pasó la primera vez.

**Permisos del repositorio** (el resto, «No access»):

| Permiso | Acceso | Para qué |
|---|---|---|
| Actions | Read-only | ejecuciones, jobs y pasos de los agentes |
| Checks | Read-only | checks del PR |
| Commit statuses | Read-only | estado `ci (Enjambre)` |
| Contents | Read and write | fusionar |
| Issues | Read and write | etiquetas |
| Metadata | Read-only | obligatorio |
| Pull requests | Read and write | leer y aprobar |

**Eventos a los que suscribirse:**
- Check run
- Issue comment
- Issues
- Pull request
- Pull request review
- Status
- Workflow job
- Workflow run

Después, en la página de la app:

1. **Generate a new client secret**. Cópialo para el paso 3: GitHub solo lo enseña una vez.
2. Copia también el **Client ID**.
3. **Install App → Only select repositories**: `lobby`, `finance_tracker` y `enjambre`. Para un repo nuevo, añádelo aquí; el panel lo mostrará sin tocar código.

¿Por qué una GitHub App y no una OAuth App? El token de usuario de una GitHub App solo llega a los repos donde está instalada y a los permisos de arriba ([docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)). Además, un solo webhook sirve para todos los repos. Una OAuth App pediría `repo`, que da acceso a todos tus repos privados.

## 3. Poner los secretos

Desde `panel/`, cada comando pide el valor y lo guarda en Cloudflare:

```
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put WEBHOOK_SECRET
npm run clave
npx wrangler secret put CLAVE_SESION
```

- `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` son los del paso 2.
- `WEBHOOK_SECRET` es el mismo que pusiste en la app.
- `npm run clave` imprime una clave aleatoria de 32 bytes: pégala en `CLAVE_SESION`. Sirve para cifrar tu token de GitHub dentro del Durable Object.

Para que entre otra cuenta, cambia `PROPIETARIOS` en `panel/wrangler.toml` y vuelve a desplegar. Hoy solo entra `AlvaroM99`.

## 4. Comprobar

1. Abre la URL y pulsa **Entrar con GitHub**. La primera vez, GitHub pide autorizar la app.
2. En la barra debe salir «En vivo». En unos segundos aparecen las issues y los PR abiertos de los tres repos.
3. En la app, **Advanced → Recent Deliveries** debe mostrar entregas con respuesta 200.
4. Pon `enjambre:planificar` en una issue desde el panel. El jefe de proyecto aparece en «Agentes trabajando ahora» con su paso actual. Al terminar pasa a «Terminado en las últimas 2 horas».

## Cómo se lleva una issue hasta la fusión sin salir del panel

Pulsa el título de una issue en el tablero. Se abre su cajón con:

- el flujo en 4 pasos: plan → tu aprobación → PR → tu revisión;
- la descripción y los comentarios;
- los botones de cada paso.

| Paso | Botón | Qué pasa |
|---|---|---|
| 1 | **Planificar** | El jefe de proyecto escribe el plan como comentario. La tarjeta avisa «Plan listo: revísalo y apruébalo» y el cajón lo marca con ★ |
| 2 (puerta 1) | **Aprobar plan e implementar** → **Confirmar** | Pone `enjambre:implementar` y arranca el implementador. Solo se activa si hay plan y ningún implementador trabajando |
| 3 | (solo) | El implementador abre el PR en borrador. La CI y la revisión arrancan solas ([ADR 0014](decisiones/0014-revision-automatica.md)) y el PR aparece en el cajón |
| 4 (puerta 2) | **Revisar PR** → **Aprobar** → **Fusionar…** | Lees el diff, los checks y los veredictos, y fusionas atado al commit que ves. **Pedir otra revisión** vuelve a lanzar revisor y seguridad |

También está **Analizar**, para pedir un informe al analista.

**Por qué no basta con poner etiquetas a mano.** Los workflows arrancan con el *evento* de poner una etiqueta, no con que la etiqueta esté puesta. Además, el implementador necesita un comentario «## Plan». Eso es lo que pasó en finance_tracker#16:

1. Se pusieron `enjambre:implementar` y `enjambre:planificar` a la vez.
2. El implementador arrancó antes de que existiera el plan, dijo «no hay plan» y paró.
3. Después, `implementar` siguió puesta y ya no había forma de volver a lanzarla.

Los botones lo resuelven así:

- **Etiquetas:** quitan y vuelven a poner la etiqueta, y antes quitan las que sobran. Nunca tocan `enjambre:en-curso`, que la gestiona el workflow.
- **Plan:** antes de implementar comprueban que hay un plan.
- **«+ etiqueta»:** ya no ofrece `enjambre:en-curso` ni, en una issue, `enjambre:revisar`, que solo sirve en un PR.

## Cómo es de fiable

- **Webhooks:** GitHub avisa de cada cambio. El panel comprueba la firma (`X-Hub-Signature-256`) y descarta las entregas repetidas.
- **Pasos:** GitHub no manda un webhook por paso de un job. Mientras hay jobs en marcha y el panel está abierto, se consultan cada 10 s.
- **Conciliación:**
  - al abrir el panel y cada 5 min, relee de la API las issues, los PR y las ejecuciones de cada repo, y corrige lo que se perdiera;
  - la barra dice cuándo fue la última y cuántas correcciones lleva;
  - si un dato no viene de GitHub, aparece como «sin datos».
- **Revisiones lanzadas con `workflow_dispatch`** ([ADR 0014](decisiones/0014-revision-automatica.md)): no dicen su PR. Se enlazan con él cuando el bot publica el veredicto.

## Seguridad

- **Acceso:**
  - solo entran las cuentas de `PROPIETARIOS`;
  - la cookie de sesión es `HttpOnly`, `Secure` y `SameSite=Strict`;
  - el token de GitHub se guarda cifrado con AES-GCM;
  - las escrituras exigen el mismo origen y una cabecera anti-CSRF.
- **Fusionar:**
  - va atado al commit que estás viendo: si llega otro, GitHub la rechaza;
  - pide confirmación en la página;
  - avisa si la CI no está en verde o falta el APROBAR del revisor;
  - un borrador no se puede fusionar.
- **Navegador:**
  - CSP sin scripts de fuera;
  - todo lo que viene de GitHub se pinta como texto.
- **Destinos:** la API y el login solo pueden apuntar a `github.com`, o a `localhost` en las pruebas (`panel/src/github.js`, función `bases`).

## Pruebas

| Prueba | Comando | Qué cubre |
|---|---|---|
| Unitarias | `npm test` en la raíz | `pruebas/panel.test.mjs`: reductor de estado, firma, sesión y la Sala con un GitHub simulado |
| e2e | `cd panel && npm run e2e` | GitHub falso en `:8791`, `wrangler dev` en `:8790` (nunca el 8787 de lobby) y Chrome |

La e2e recorre:
- el login;
- dos agentes a la vez en dos repos, con su paso en vivo;
- poner y quitar etiquetas;
- aprobar y fusionar atado al SHA;
- que un borrador no se fusiona;
- el webhook con firma falsa;
- que no se puede fusionar sin sesión.

Todo con datos sintéticos.
