# Contenedor base de Enjambre (historia S5): Node 24, wrangler (vía npx del proyecto),
# Chrome para Playwright, Claude Code fijado y dependencias del sandbox de Linux.
FROM node:24-bookworm

ARG CLAUDE_CODE_VERSION=2.1.330
ARG PLAYWRIGHT_VERSION=1.65.1

ENV DEVCONTAINER=true \
    DISABLE_AUTOUPDATER=1 \
    NPM_CONFIG_PREFIX=/usr/local/share/npm-global \
    PATH=$PATH:/usr/local/share/npm-global/bin

# bubblewrap y socat: requisitos del sandbox de Claude Code en Linux.
RUN apt-get update && apt-get install -y --no-install-recommends \
      bubblewrap socat git gh jq ripgrep less procps python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Chrome estable (las pruebas de lobby usan channel: 'chrome').
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chrome \
    && rm -rf /var/lib/apt/lists/*

# Claude Code en versión fija (se actualiza cambiando el ARG y pasando las evaluaciones).
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share/npm-global \
    && echo 'export PATH=$PATH:/usr/local/share/npm-global/bin' > /etc/profile.d/npm-global.sh
USER node
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Política gestionada: sandbox obligatorio y sin modo bypass.
USER root
COPY managed-settings.json /etc/claude-code/managed-settings.json
RUN mkdir -p /workspace /home/node/.claude && chown -R node:node /workspace /home/node/.claude

USER node
WORKDIR /workspace
