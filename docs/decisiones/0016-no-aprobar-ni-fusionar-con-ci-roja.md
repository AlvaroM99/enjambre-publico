# ADR 0016: no se aprueba ni se fusiona con la CI en rojo

- Estado: **propuesta** (Álvaro pidió solo el plan, 23-11-2026)
- Relacionado: [ADR 0011](0011-solo-alvaro-aprueba.md), [ADR 0014](0014-revision-automatica.md), [ADR 0015](0015-panel-en-vivo.md)

## Contexto

En finance_tracker#26 la CI y el revisor salieron en rojo, y Álvaro pudo aprobar y fusionar igualmente. Las dos causas de ese rojo se corrigen en la v0.7.1 (ADR 0014). Pero Álvaro pide más: que, si la CI falla, **no pueda** aprobar ni fusionar.

Hoy se puede aprobar y fusionar desde tres sitios:
- **Hive:** avisa de que la CI está en rojo, pero deja seguir.
- **github.com y la app del móvil:** nada lo impide.
- **`gh` en su terminal:** nada lo impide. El hook `gh-pr-aprobar` solo afecta a los agentes.

**Límite comprobado el 23-11-2026.** En repos privados con GitHub Free no hay protección de rama ni rulesets. La API responde «Upgrade to GitHub Pro or make this repository public to enable this feature» (`GET /repos/AlvaroM99/{lobby,finance_tracker}/rulesets` y `…/branches/main/protection`, HTTP 403). Sin eso, GitHub no puede impedir una fusión. Solo Hive puede, y solo en Hive.

## Propuesta: tres capas

### 1. Hive bloquea en el servidor (sin coste)

En `panel/src/sala.js` y `panel/src/acciones.js`, antes de aprobar (`/api/aprobar`, `/api/pr/resena` con `aprobar`) y de fusionar (`/api/fusionar`):

- **Releer la CI del commit que se ve.** Se piden a GitHub en ese momento los estados y el último intento de cada check de la cabeza del PR, con `estadoGlobalCi`, el que ya corrige el «pending» falso.
- **Aprobar y fusionar solo con la CI en verde.** «En marcha», «roja» o «sin CI» devuelven 409 con el motivo y el check que falla.
  - **Sin CI también bloquea:** un PR sin ningún check no se puede dar por bueno.
- **No fiarse de la página.** La comprobación vive en el servidor: aunque alguien llame a la API a mano, no pasa.

En la página:
- Los botones **Aprobar** y **Fusionar…** salen desactivados con la causa («La CI está en rojo: falla `rust`»).
- Al lado: **Ver el fallo**, que abre el registro del job, y **Relanzar la CI**, que reintenta los jobs fallidos.
- La Bandeja ya separa «CI roja» de «para revisar».

Pruebas:
- **Unitarias:** cubren verde, rojo, en marcha, sin CI y un check relanzado en verde tras un fallo.
- **e2e:** un PR con CI roja no se aprueba ni se fusiona, y al ponerse verde sí.

Talla S.

### 2. Cada PR publica su CI con el mismo nombre (sin coste)

Hoy `estado-en-el-pr` solo publica `ci (Enjambre)` cuando la CI la lanzó el implementador (`workflow_dispatch`). Un PR abierto a mano no lo tiene.

**Cambio:**
- el job corre también en `pull_request`;
- publica el estado en `github.event.pull_request.head.sha`, la cabeza del PR, y no en el commit de fusión.

Así todos los PR tienen un check con el mismo nombre, que Hive (capa 1) y GitHub (capa 3) pueden exigir. Va en la plantilla `ci.yml` y en un PR por proyecto.

### 3. GitHub bloquea de verdad (necesita GitHub Pro)

Con GitHub Pro [POR CONFIRMAR el precio actual; históricamente 4 USD al mes], un **ruleset** sobre `main` en lobby, finance_tracker y enjambre:

- **PR obligatorio:** nada entra en `main` sin un PR.
- **CI obligatoria:** se exige el check `ci (Enjambre)` en verde (*Require status checks to pass*). Sin él, GitHub no deja fusionar desde ningún sitio: web, móvil, `gh` ni la API.
- **Historia protegida:** se bloquean el *force push* y el borrado de `main`.
- **Sin excepciones:** ni para administradores. Si un día hiciera falta saltárselo, se quita el ruleset a mano, y queda en el historial de auditoría.

El ruleset es configuración de la cuenta de Álvaro: lo crea él, o Claude con `gh api` si él lo pide expresamente.

**Aprobar** no se puede impedir en GitHub, porque una reseña no fusiona. Con la capa 3, una aprobación con la CI en rojo no sirve para nada: el botón de fusionar sigue bloqueado.

**Sin Pro**, la protección es parcial:
- Hive bloquea (capa 1), pero github.com y `gh` no.
- Como red de seguridad, un workflow en `push` a `main` podría abrir una issue «Fusionado con la CI en rojo» si el commit fusionado no tenía `ci (Enjambre)` en verde. Avisa, no impide.

## Decisiones para Álvaro

1. **¿GitHub Pro?** Con Pro, la capa 3 garantiza el bloqueo en todas partes. Sin Pro, el bloqueo es solo en Hive, más el aviso de la red de seguridad.
2. **¿Exigir también el APROBAR del revisor de Enjambre** para fusionar?
   - En Hive es fácil.
   - En GitHub con Pro se puede convertir su veredicto en un estado de commit (`revisión (Enjambre)`) y exigirlo también.
3. **¿Algún botón de emergencia en Hive** para saltarse el bloqueo? Se propone que no: la emergencia se resuelve quitando el ruleset a mano.

## Orden propuesto

1. Capa 1 (Hive) y capa 2 (CI publicada en todo PR), con sus pruebas. Hive se despliega y la plantilla llega por PR a cada proyecto.
2. Si Álvaro elige Pro, el ruleset en los tres repos, comprobado con un PR de prueba con la CI en rojo (no se puede fusionar) y otro en verde (sí).
3. Sin Pro, el workflow de aviso en `main`.
