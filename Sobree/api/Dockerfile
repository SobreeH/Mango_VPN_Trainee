FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY Rain/admin/package.json ./Rain/admin/
COPY Rain/portal/package.json ./Rain/portal/
COPY Sobree/api/package.json ./Sobree/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY Rain/admin ./Rain/admin
COPY Sobree/api ./Sobree/api

RUN npm run db:generate
RUN npm --workspace=@mango/shared run build \
  && npm --workspace=@mango/rain-admin run build \
  && npm --workspace=@mango/api run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/Rain/admin/package.json ./Rain/admin/
COPY --from=builder /app/Rain/admin/dist ./Rain/admin/dist
COPY --from=builder /app/Sobree/api/package.json ./Sobree/api/
COPY --from=builder /app/Sobree/api/dist ./Sobree/api/dist
COPY --from=builder /app/Sobree/api/prisma ./Sobree/api/prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma && node Sobree/api/dist/server.js"]
