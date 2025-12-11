FROM node:18

WORKDIR /app

# Copier seulement package.json, pour éviter de copier node_modules Windows
COPY package*.json ./

# Installer dépendances Linux
RUN npm install

# Maintenant copier TOUT le backend
COPY . .

EXPOSE 8000

CMD ["node", "server.js"]
