# Docker vs Docker-compose

## Docker - для отдельных контейнеров

**Docker** работает с одним контейнером за раз.

### Пример с Docker:
```dockerfile
# Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

```bash
# Запуск одного контейнера
docker build -t my-app .
docker run -p 3000:3000 my-app

# Для базы данных нужно запускать отдельно:
docker run -d --name my-db -p 5432:5432 postgres:13
```

## Docker Compose - для нескольких связанных контейнеров

**Docker Compose** управляет несколькими контейнерами как одним приложением.

### Пример с Docker Compose:
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - database
      - redis
  
  database:
    image: postgres:13
    environment:
      POSTGRES_DB: myapp
  
  redis:
    image: redis:alpine
```

```bash
# Запуск ВСЕХ сервисов одной командой
docker-compose up
```

## Сравнение в таблице

| Аспект | Docker | Docker Compose |
|--------|--------|----------------|
| **Область** | Один контейнер | Мульти-контейнерное приложение |
| **Команды** | `docker run`, `docker build` | `docker-compose up`, `docker-compose down` |
| **Конфигурация** | Dockerfile | docker-compose.yml + Dockerfile |
| **Сети** | Ручная настройка | Автоматическая сеть между сервисами |
| **Зависимости** | Ручное управление | Автоматическое через `depends_on` |
| **Переменные** | Флаги `-e`, `--env` | Файл `.env`, секция `environment` |

## Практический пример

### Ситуация: Веб-приложение + БД + Redis

**С Docker (сложно):**
```bash
# 1. Создаем сеть
docker network create my-app-network

# 2. Запускаем БД
docker run -d --name db --network my-app-network \
  -e POSTGRES_PASSWORD=pass postgres:13

# 3. Запускаем Redis
docker run -d --name redis --network my-app-network redis:alpine

# 4. Запускаем приложение
docker run -d --name app --network my-app-network \
  -p 3000:3000 -e DB_HOST=db my-app
```

**С Docker Compose (просто):**
```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [db, redis]
  
  db:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: pass
  
  redis:
    image: redis:alpine
```

```bash
# Одна команда!
docker-compose up -d
```

## Ключевые различия

### Docker:
- ✅ Идеально для одного сервиса
- ✅ Больше контроля над каждым контейнером
- ✅ Лучше для продакшн-развертываний
- ❌ Сложно управлять зависимостями
- ❌ Много ручных команд

### Docker Compose:
- ✅ Идеально для разработки
- ✅ Простое описание всей инфраструктуры
- ✅ Автоматические сети и зависимости
- ✅ Одна команда для всего
- ❌ В основном для разработки/тестирования

## Когда что использовать?

**Используйте Docker:**
- Когда нужен один изолированный сервис
- Для продакшн-развертываний (часто с оркестраторами типа Kubernetes)
- Для создания базовых образов

**Используйте Docker Compose:**
- Для локальной разработки
- Когда приложение состоит из нескольких сервисов
- Для тестирования сложных систем
- Для демонстрационных сред

## Простая аналогия

- **Docker** - как управлять одним автомобилем
- **Docker Compose** - как управлять целым автопарком с водителями, маршрутами и расписанием

Оба инструмента часто используются вместе: Docker для создания образов, Docker Compose для оркестрации этих образов в разработке.