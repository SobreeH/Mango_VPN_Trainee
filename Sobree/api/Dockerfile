FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo files
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY Rain ./Rain
COPY Sobree ./Sobree

# Install dependencies and build shared packages
RUN npm ci || npm install
RUN npm --workspace=@mango/shared run build
RUN npm --workspace=@mango/rain-admin run build
RUN npm --workspace=@mango/api run prisma:generate
RUN npm --workspace=@mango/api run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/Rain/admin/dist ./Rain/admin/dist
COPY --from=builder /app/Rain/admin/package.json ./Rain/admin/package.json
COPY --from=builder /app/Sobree/api/dist ./Sobree/api/dist
COPY --from=builder /app/Sobree/api/prisma ./Sobree/api/prisma
COPY --from=builder /app/Sobree/api/package.json ./Sobree/api/package.json

EXPOSE 4000

CMD ["node", "Sobree/api/dist/server.js"]
