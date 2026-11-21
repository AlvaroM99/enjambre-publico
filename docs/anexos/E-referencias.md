# Anexo E: referencias

> Enjambre · [Plan principal](../PLAN.md) · [A Inventario](A-inventario.md) · [B Arquitectura](B-arquitectura.md) · [C Fichas](C-fichas-agentes.md) · [D Backlog](D-backlog.md) · [E Referencias](E-referencias.md)

## 10. Referencias

**Anthropic / Claude**
- https://code.claude.com/docs/en/sub-agents — formato de subagentes, anidamiento, aislamiento de contexto.
- https://code.claude.com/docs/en/skills — Skills, divulgación progresiva, frontmatter.
- https://code.claude.com/docs/en/plugins — plugins y marketplaces para distribuir el equipo.
- https://code.claude.com/docs/en/hooks — eventos de hooks y decisiones de bloqueo.
- https://code.claude.com/docs/en/permissions y https://code.claude.com/docs/en/permission-modes — reglas deny/ask/allow y modos.
- https://code.claude.com/docs/en/sandboxing — *sandbox*; no soportado en Windows nativo.
- https://code.claude.com/docs/en/settings — jerarquía de configuración.
- https://code.claude.com/docs/en/memory — CLAUDE.md, reglas, memoria automática.
- https://code.claude.com/docs/en/headless — `claude -p`, JSON, `--max-budget-usd`.
- https://code.claude.com/docs/en/github-actions y https://github.com/anthropics/claude-code-action — Claude en Actions (v1), autenticación, disparadores.
- https://code.claude.com/docs/en/claude-code-on-the-web — sesiones en la nube.
- https://code.claude.com/docs/en/agent-teams — agent teams (experimental).
- https://code.claude.com/docs/en/agent-sdk/overview, …/hosting, …/cost-tracking, …/permissions, …/subagents — Agent SDK.
- https://platform.claude.com/docs/en/managed-agents/overview — Managed Agents (beta).
- https://platform.claude.com/docs/en/about-claude/models/overview y https://platform.claude.com/docs/en/about-claude/pricing — modelos y precios.
- https://claude.com/pricing — planes.
- https://code.claude.com/docs/en/costs — coste medio y controles.
- https://code.claude.com/docs/en/monitoring-usage — OpenTelemetry de Claude Code.
- https://platform.claude.com/docs/en/manage-claude/workspaces — workspaces y límites de gasto.
- https://code.claude.com/docs/en/best-practices — buenas prácticas de Claude Code.
- https://www.anthropic.com/engineering/building-effective-agents — patrones de agentes; empezar simple.
- https://www.anthropic.com/engineering/multi-agent-research-system — orquestador-trabajadores; coste ~15×; mal encaje en código.
- https://www.anthropic.com/engineering/writing-tools-for-agents — diseño de herramientas.
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — ingeniería de contexto.
- https://www.anthropic.com/engineering (índice) — «Effective harnesses for long-running agents», «Harness design for long-running application development», «Demystifying evals for AI agents», «How we contain Claude across products».

**MCP y conectores**
- https://modelcontextprotocol.io/specification/latest — especificación MCP 2026-07-28 y autorización OAuth 2.1.
- https://github.com/atlassian/atlassian-mcp-server y https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ — MCP de Atlassian v2.
- https://github.com/github/github-mcp-server — MCP de GitHub, *toolsets*, solo lectura.
- https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/ — MCP de Cloudflare.

**Ingeniería y gestión**
- https://scrumguides.org/scrum-guide.html — Scrum Guide 2020.
- https://kanbanguides.org/english/ — Kanban Guide v2025.5, WIP y métricas de flujo.
- https://dora.dev/guides/dora-metrics/ — 5 métricas DORA.
- https://dora.dev/dora-report-2025/ — IA como amplificador; inestabilidad.
- https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model — 7 capacidades DORA para IA.
- https://trunkbaseddevelopment.com/ y https://docs.github.com/en/get-started/using-github/github-flow — flujo Git.
- https://www.conventionalcommits.org/en/v1.0.0/ y https://semver.org/ — commits y versionado.
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets — rulesets (contradicción de planes: ver nota).
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners — CODEOWNERS.
- https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions — endurecimiento de Actions.
- https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available — lockfiles de Actions.
- https://support.atlassian.com/jira-cloud-administration/docs/explore-jira-cloud-plans/ — Jira Free (10 usuarios, 150 pasos).
- https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/ — importación CSV.
- https://www.atlassian.com/blog/announcements/ai-agents-in-jira — agentes en Jira.

**Seguridad**
- https://genai.owasp.org/llm-top-10/ — OWASP Top 10 LLM 2025.
- https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications/ — OWASP Top 10 Agentic 2026.
- https://owasp.org/www-project-application-security-verification-standard/ — ASVS 5.0.
- https://owaspsamm.org/model/ — SAMM v2.
- https://csrc.nist.gov/pubs/sp/800/218/a/final y https://csrc.nist.gov/pubs/sp/800/218/r1/ipd — SSDF y perfil GenAI.
- https://slsa.dev/spec/ — SLSA v1.2 (pistas Build y Source).
- https://scorecard.dev/ — OpenSSF Scorecard.
- https://www.nist.gov/itl/ai-risk-management-framework — NIST AI RMF.
- https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ — tríada letal.
- https://ai.meta.com/blog/practical-ai-agent-security/ — regla de dos.
- https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations — salvaguardas de referencia de un agente de código comercial.

**Pruebas, observabilidad, datos**
- https://martinfowler.com/articles/practical-test-pyramid.html — pirámide de pruebas.
- https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications — trofeo de pruebas.
- https://stryker-mutator.io/docs/ — pruebas de mutación.
- https://github.com/open-telemetry/semantic-conventions-genai — convenciones GenAI de OTel (en desarrollo).
- https://www.databricks.com/glossary/medallion-architecture — arquitectura medallion.
- https://docs.getdbt.com/docs/mesh/govern/model-contracts — contratos de modelo dbt.
- https://github.com/bitol-io/open-data-contract-standard — ODCS.
- https://blog.cloudflare.com/cloudflare-basin/ — Basin (Pipelines, Catalog, SQL).
- https://developers.cloudflare.com/d1/platform/pricing/ y https://developers.cloudflare.com/r2/pricing/ — límites D1/R2.
- https://www.metabase.com/pricing/, https://evidence.dev/pricing, https://cloud.google.com/blog/products/data-analytics/looker-studio-is-data-studio — herramientas BI.

**Sistemas multiagente de código**
- https://arxiv.org/abs/2503.13657 — MAST: por qué fallan los sistemas multiagente.
- https://cognition.com/blog/dont-build-multi-agents y https://cognition.com/blog/multi-agents-working — un escritor + asesores.
- https://arxiv.org/abs/2308.00352 (MetaGPT), https://arxiv.org/abs/2307.07924 (ChatDev), https://arxiv.org/abs/2407.16741 (OpenHands), https://github.com/SWE-agent/mini-swe-agent — enfoques comparados.
- https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ — límites de SWE-bench Verified (usar evaluaciones propias).
- https://www.finops.org/wg/token-economics/ — FinOps para IA.

**Contradicciones entre fuentes y qué recomiendo**
1. **Rulesets en repos privados:** una página de GitHub dice Team/Enterprise, otra incluye Pro. → Comprobar en tu repo tras pasar a Pro (S15); si no, protección clásica de rama.
2. **Multiagente:** Anthropic (+90 % en investigación) frente a Cognition («no construyas multiagentes»). → Se concilian: paralelizar lectura/revisión, un solo escritor. Es lo que propongo.
3. **Pirámide frente a trofeo:** pirámide en backend, trofeo en la SPA (§5.7).
4. **DORA 2024 frente a 2025** sobre productividad con IA: ambas coinciden en que la inestabilidad sube → justificar aprobación humana y rollback.
5. **Jira «200 ejecuciones» frente a «150 pasos»:** uso la página actual (150 pasos).
6. **Lockfiles de Actions y dependencias transitivas:** sigo el anuncio GA de GitHub, con fijación por SHA como respaldo.
7. **Span kind de `invoke_agent` en OTel:** no construir sobre ello hasta versión estable.
