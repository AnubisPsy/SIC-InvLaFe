# Imagen del backend de SIC-InvLaFe.
#
# Dos etapas: la primera compila TypeScript con todas las dependencias; la
# segunda solo lleva lo compilado y las dependencias de producción, para que la
# imagen final sea pequeña y no incluya herramientas de desarrollo.

# --- 1. Compilar -------------------------------------------------------------
FROM node:22-alpine AS compilar
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- 2. Ejecutar -------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=compilar /app/dist ./dist
COPY db ./db

# Sin privilegios de administrador dentro del contenedor.
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud > /dev/null || exit 1

CMD ["node", "dist/index.js"]
