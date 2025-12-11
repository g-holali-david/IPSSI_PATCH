# Étape 1 : build React
FROM node:18 AS build

WORKDIR /app/my-app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Étape 2 : serveur NGINX pour servir le build
FROM nginx:alpine

COPY --from=build /app/my-app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
