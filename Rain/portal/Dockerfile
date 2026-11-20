FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY Rain/admin/package.json ./Rain/admin/
COPY Rain/portal/package.json ./Rain/portal/
COPY Sobree/api/package.json ./Sobree/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY Rain/portal ./Rain/portal

ARG VITE_API_URL=http://localhost:4000
ARG VITE_AGENT_URL=http://127.0.0.1:47821
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_AGENT_URL=${VITE_AGENT_URL}

RUN npm --workspace=@mango/shared run build \
  && npm --workspace=@mango/portal run build

FROM nginx:1.27-alpine

COPY Rain/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY Rain/portal/docker-entrypoint.sh /docker-entrypoint.d/40-mango-env.sh
RUN chmod +x /docker-entrypoint.d/40-mango-env.sh
COPY --from=builder /app/Rain/portal/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
