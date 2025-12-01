FROM node:16-alpine

WORKDIR /app

# Создаём директорию для логов
RUN mkdir -p /app/logs

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]

