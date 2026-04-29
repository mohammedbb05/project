# ─── BUILD ───────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build de producció d'Angular
RUN npm run build -- --configuration production

# ─── FINAL: Nginx per servir el frontend ─────────
FROM nginx:alpine

# Copia el build d'Angular a Nginx
COPY --from=builder /app/dist/project-frontend/browser /usr/share/nginx/html

# Configuració de Nginx per Angular (gestió de rutes SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
