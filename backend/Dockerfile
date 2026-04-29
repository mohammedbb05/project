# ─── BUILD ───────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Genera el client de Prisma
RUN npx prisma generate

# ─── FINAL ───────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Crea carpeta d'uploads
RUN mkdir -p uploads

EXPOSE 3000

# Executa migracions i arrenca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
