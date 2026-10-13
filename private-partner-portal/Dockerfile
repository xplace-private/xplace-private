FROM node:24-slim AS builder

WORKDIR /app

ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm/bin:$PATH

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g --prefix /pnpm "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

COPY . .
# Vite inlines VITE_ values, so the environment is fixed here and not at deploy.
ARG BUILD_MODE
ARG SENTRY_RELEASE
RUN --mount=type=secret,id=sentry_auth_token \
    : "${BUILD_MODE:?build arg BUILD_MODE is required (dev|staging|production)}" \
    && if [ -f /run/secrets/sentry_auth_token ]; then \
         export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; \
       fi \
    && pnpm build --mode "$BUILD_MODE"

FROM nginxinc/nginx-unprivileged:1.31-alpine

# worker_processes auto считает ядра ноды, а не лимит контейнера.
RUN sed -i 's/^worker_processes.*/worker_processes 2;/' /etc/nginx/nginx.conf \
    && grep -qx 'worker_processes 2;' /etc/nginx/nginx.conf

COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
