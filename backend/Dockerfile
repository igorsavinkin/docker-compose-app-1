FROM node:16-alpine

WORKDIR /app

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Create logs directory
RUN mkdir -p /app/logs

COPY package*.json ./
RUN npm install

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
