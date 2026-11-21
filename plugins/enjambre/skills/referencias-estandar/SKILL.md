---
name: referencias-estandar
description: Repositorios de referencia, librerías y estándares de la industria que Enjambre usa como punto de partida - criterios para elegir una dependencia, librerías candidatas por stack (Cloudflare Workers, D1, frontend, Rust, pruebas) y estándares de proceso y seguridad. Úsala antes de añadir una dependencia, elegir un patrón o justificar una práctica.
---

# Referencias y estándares

Antes de inventar, copia lo que ya funciona en proyectos serios. Antes de añadir una dependencia, comprueba que merece la pena.

## 1. Orden de preferencia

1. **Lo que ya usa el proyecto** (mira `package.json`, `Cargo.toml` y el código).
2. **La plataforma**: APIs web estándar (`fetch`, `URL`, `crypto.subtle`, `Intl`) y las de Cloudflare Workers.
3. **Una librería de referencia** de la tabla de abajo.
4. Otra librería, solo con la comprobación del punto 2 y una decisión registrada (skill `tomar-decisiones`).

## 2. Comprobar una dependencia antes de proponerla

| Comprobación | Dónde | Mínimo aceptable |
|---|---|---|
| Mantenimiento | página del repo, registro de npm o crates.io | versión publicada en los últimos 12 meses |
| Seguridad | https://deps.dev y https://scorecard.dev | sin vulnerabilidades abiertas altas o críticas; Scorecard ≥ 5 si está publicado |
| Licencia | `package.json` / `Cargo.toml` del paquete | MIT, Apache-2.0, BSD o ISC |
| Tamaño | https://bundlephobia.com (JS) | proporcionado a lo que aporta; los Workers tienen límite de tamaño |
| Compatibilidad | documentación del paquete | funciona en Workers (sin APIs de Node no soportadas) |
| Sustitutos | — | no hay una API estándar que haga lo mismo |

Las versiones **no se escriben de memoria**: consulta la versión actual en el registro en el momento de usarla y fíjala en el lockfile.

## 3. Librerías y repositorios de referencia por stack

Candidatas habituales, no obligatorias. Confirma versión y encaje en cada caso.

| Necesidad | Referencia | Documentación |
|---|---|---|
| Workers: herramientas, plantillas, ejemplos | `cloudflare/workers-sdk`, `cloudflare/templates` | https://github.com/cloudflare/workers-sdk · https://github.com/cloudflare/templates |
| Enrutado HTTP en Workers | Hono | https://hono.dev |
| Validación de entradas | Zod | https://zod.dev |
| Acceso tipado a D1 | Drizzle ORM | https://orm.drizzle.team |
| Pruebas unitarias en el runtime de Workers | Vitest + `@cloudflare/vitest-pool-workers` | https://developers.cloudflare.com/workers/testing/vitest-integration/ |
| Pruebas de extremo a extremo | Playwright | https://playwright.dev |
| Pruebas sin dependencias (scripts, hooks) | `node:test` | https://nodejs.org/api/test.html |
| Workers en Rust | `cloudflare/workers-rs` | https://github.com/cloudflare/workers-rs |
| Auditoría de dependencias | `npm audit`, `cargo audit`, OSV-Scanner | https://google.github.io/osv-scanner/ |
| Acciones de CI | `actions/checkout`, `actions/setup-node` (fijadas por SHA) | https://docs.github.com/en/actions |

## 4. Estándares de proceso

| Tema | Estándar | Fuente |
|---|---|---|
| Commits | Conventional Commits 1.0.0 | https://www.conventionalcommits.org/en/v1.0.0/ |
| Versiones | SemVer 2.0.0 | https://semver.org/ |
| Registro de cambios | Keep a Changelog | https://keepachangelog.com/ |
| Flujo de ramas | GitHub flow | https://docs.github.com/en/get-started/using-github/github-flow |
| Revisión de código | Google Engineering Practices | https://google.github.io/eng-practices/review/ |
| Decisiones | ADR / MADR | https://adr.github.io/madr/ |
| Configuración de aplicaciones | The Twelve-Factor App | https://12factor.net/ |
| Métricas de entrega | DORA | https://dora.dev/guides/dora-metrics/ |
| Pruebas | Pirámide (backend) y trofeo (frontend) | https://martinfowler.com/articles/practical-test-pyramid.html |

## 5. Estándares de seguridad

| Tema | Estándar | Fuente |
|---|---|---|
| Requisitos de seguridad de aplicaciones | OWASP ASVS 5.0 | https://owasp.org/www-project-application-security-verification-standard/ |
| Riesgos web | OWASP Top 10 | https://owasp.org/Top10/ |
| Riesgos de LLM y agentes | OWASP Top 10 LLM 2025 y Agentic | https://genai.owasp.org/llm-top-10/ |
| Desarrollo seguro | NIST SSDF (SP 800-218) | https://csrc.nist.gov/pubs/sp/800/218/final |
| Cadena de suministro | SLSA, OpenSSF Scorecard | https://slsa.dev/spec/ · https://scorecard.dev/ |
| Endurecer GitHub Actions | Guía de GitHub | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |

## 6. Cómo citarlo

En el plan o el PR: «Validación con Zod (https://zod.dev), como recomienda la skill `referencias-estandar`; versión fijada en `package-lock.json`». Si algo de esta tabla ya no es cierto (librería abandonada, URL caída), dilo en el PR para actualizar la skill.
