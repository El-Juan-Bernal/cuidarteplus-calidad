# Etapa 1: Construcción
FROM node:26 AS builder
 
WORKDIR /app
 
ARG VITE_API_URL=http://localhost:4444
 
COPY package*.json ./
 
# Instalación limpia de dependencias para Linux
RUN npm install && \
    npm install @rollup/rollup-linux-x64-gnu@4 --save-optional
 
COPY . .
 
ENV VITE_API_URL=${VITE_API_URL}
 
RUN npm run build
 
# Etapa 2: Producción
FROM nginx:1.27-alpine
 
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
 
EXPOSE 80
 
CMD ["nginx", "-g", "daemon off;"]

