# Imagen del frontend de SIC-InvLaFe.
#
# La primera etapa compila la app con Node; la segunda es un nginx que solo
# sirve los archivos ya compilados y reenvía /api al backend. nginx usa unos
# pocos MB de memoria: Node no se queda corriendo.

# --- 1. Compilar -------------------------------------------------------------
FROM node:22-alpine AS compilar
WORKDIR /app

# Primero solo los package.json: así Docker reutiliza la capa de `npm ci`
# mientras no cambien las dependencias, y reconstruir es mucho más rápido.
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/query/package.json packages/query/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages ./packages
COPY apps ./apps

# "/" significa "el mismo servidor que sirve la página": nginx reenvía /api.
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- 2. Servir ---------------------------------------------------------------
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilar /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
