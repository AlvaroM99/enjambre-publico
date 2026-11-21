---
name: gobernanza
description: Lista de comprobación de gobernanza de código y datos de Enjambre - estructura y jerarquía de carpetas, documentación y ADR al día, convenciones de código, dependencias y licencias, coherencia de agentes, hooks, permisos y CI, gobierno de datos (sin datos reales, clasificación, retención) y trazabilidad. Con puntuación de 0 a 3 por área y plantilla de informe. Úsala al auditar un repositorio o al incorporar un proyecto a Enjambre.
---

# Gobernanza de código y datos

Un repositorio bien gobernado se entiende sin preguntar: cada cosa está donde se espera, los documentos dicen la verdad y se sabe quién decidió qué.

## Puntuación por área

| Nota | Significado |
|---|---|
| 3 | Cumple; nada que corregir |
| 2 | Pequeñas desviaciones; se corrigen en un PR S |
| 1 | Problemas que confunden o generan riesgo; PR M o varios |
| 0 | Falta la base (p. ej. sin README, datos reales versionados) |

Un **0 en Datos** es siempre crítico: se avisa a Álvaro en el informe antes que cualquier otra cosa.

## 1. Estructura y jerarquía

- [ ] Raíz limpia: solo configuración y documentos de entrada (`README.md`, `CLAUDE.md`, `package.json`…). Comando: `git ls-files | grep -v / `.
- [ ] Carpetas con un propósito único y nombre coherente (mismo idioma y estilo en todo el repo).
- [ ] Sin duplicados (dos carpetas de pruebas, dos de docs), restos (`old/`, `copia/`, `*.bak`) ni ficheros grandes binarios versionados. Comando: `git ls-files | grep -Ei '(old|copia|backup|\.bak)'`.
- [ ] Profundidad razonable (≤ 4 niveles para el código de aplicación).
- [ ] Las copias que deben ser idénticas lo son (en Enjambre, `npm test` lo comprueba).

## 2. Documentación

- [ ] `README.md`: qué es, cómo se ejecuta, cómo se prueba, estado actual. Coincide con la realidad (comandos que existen en `package.json`).
- [ ] `CLAUDE.md` corto, con reglas vigentes, sin contradicciones con los ADR.
- [ ] Documentos con fecha cuando describen un estado; los superados, marcados como histórico.
- [ ] Enlaces internos vivos. Comando: buscar `](` en `docs/` y comprobar que la ruta existe con `ls`.
- [ ] Etiquetas de certeza ([POR CONFIRMAR]) revisadas: ¿alguna ya se puede confirmar?

## 3. Decisiones (ADR)

- [ ] Numeradas sin huecos, con fecha, estado (Propuesta, Aceptada, Sustituida) y quién decide.
- [ ] Las sustituidas enlazan a la que las sustituye.
- [ ] El código y la configuración cumplen las aceptadas (muestreo: 3 decisiones al azar).
- [ ] Decisiones difíciles de deshacer sin ADR (dependencias, esquema, servicios): hallazgo.

## 4. Código

- [ ] Convenciones del proyecto aplicadas (nombres, formato, idioma de comentarios).
- [ ] Pruebas junto al código o en la carpeta acordada; módulos sin prueba listados.
- [ ] `TODO`/`FIXME` sin issue enlazado. Comando: `git grep -nE 'TODO|FIXME'`.
- [ ] Código muerto evidente (ficheros sin importar, scripts sin uso en `package.json`).

## 5. Dependencias y licencias

- [ ] Lockfile versionado; versiones fijadas.
- [ ] `npm outdated`, `npm audit --omit=dev` (o `cargo tree`, `cargo audit`): sin vulnerabilidades altas ni dependencias abandonadas (skill `referencias-estandar`).
- [ ] Licencias compatibles (skill `investigar-estado-del-arte`, apartado 4). Licencia propia del repo presente si es público.

## 6. Agentes, permisos y CI

- [ ] `.claude/settings.json` del proyecto parte de la plantilla de Enjambre; las diferencias están justificadas.
- [ ] Workflows con SHA fijados, permisos mínimos, `concurrency` y `timeout-minutes` (skill `ci-cd`).
- [ ] Ningún workflow de producción se dispara sin el propietario.
- [ ] Secretos que el código espera documentados por nombre (no por valor).

## 7. Datos

- [ ] **Sin datos reales ni personales versionados.** Buscar patrones con `git grep -nIE` sobre ficheros versionados: correos (`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}`), IBAN (`\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b`), tokens (`(ghp_|github_pat_|sk-|xox[bp]-)[A-Za-z0-9_-]{10,}`). En el informe, cita **fichero:línea y tipo**, nunca el valor.
- [ ] `.gitignore` cubre `.env*`, `.dev.vars`, `datos/`, exportaciones y bases locales.
- [ ] Datos de prueba sintéticos y documentados (de dónde salen, cómo se regeneran).
- [ ] Esquema de datos y migraciones versionados y en orden; contratos de datos si hay pipelines.
- [ ] Clasificación y retención: qué datos guarda la aplicación, cuáles son personales, cuánto tiempo y cómo se borran (documentado).

## 8. Trazabilidad

- [ ] Commits con Conventional Commits; ramas `enjambre/<clave>-<slug>`.
- [ ] PR enlazados a su issue; issues cerrados enlazados a su PR.
- [ ] Backlog coherente con el estado real (historias hechas marcadas).
- [ ] Ramas remotas viejas (> 30 días sin PR abierto). Comando: `git branch -r --sort=-committerdate`.

## Informe

Plantilla `plantilla-gobernanza.md` de esta skill (`${CLAUDE_SKILL_DIR}/plantilla-gobernanza.md`). Agrupa los hallazgos de forma que cada grupo se pueda corregir en **un PR** de menos de 400 líneas.

## Fuentes

- OpenSSF Scorecard (prácticas de repositorio): https://scorecard.dev/
- GitHub, buenas prácticas de repositorio (README, licencia, CODEOWNERS): https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories
- ADR: https://adr.github.io/
- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/
- Gobierno de datos y contratos: https://github.com/bitol-io/open-data-contract-standard
