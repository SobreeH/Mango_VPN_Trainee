FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY Rain ./Rain

RUN npm ci || npm install
RUN npm --workspace=@mango/shared run build
RUN npm --workspace=@mango/portal run build

FROM nginx:alpine AS runner

COPY --from=builder /app/Rain/portal/dist /usr/share/nginx/html

# Custom nginx conf for SPA routing
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
