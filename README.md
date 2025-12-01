# Node.js Docker App with PostgreSQL

A simple REST API application built with Node.js, Express, and PostgreSQL, fully containerized with Docker.

## Project Structure

```
/
├── docker-compose.yml
├── .env                      # Переменные окружения (не в git)
├── .env.example              # Шаблон переменных
├── .gitignore
├── README.md
├── project structure.md
├── docker-vs-docker-compose.md
├── common/
│   └── project-containers.png
├── nginx/
│   └── nginx.conf            # Конфигурация nginx
├── frontend/
│   └── index.html            # Статический фронтенд
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── server.js
    ├── init.sql
    ├── migrate-config.js     # Конфигурация миграций
    ├── run-migrations.js     # Модуль запуска миграций
    └── migrations/           # Миграции базы данных
        ├── 1701408000000_create-users-table.js
        ├── 1701408001000_seed-initial-users.js
        └── 1701408002000_add-user-phone-column.js
```

## Tech Stack

- **Runtime:** Node.js 16 (Alpine)
- **Framework:** Express.js
- **Database:** PostgreSQL 13
- **Migrations:** node-pg-migrate
- **Web Server:** Nginx (Alpine)
- **Containerization:** Docker & Docker Compose
- **Monitoring:** Health checks для всех сервисов

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### Run the Application

```bash
docker-compose up --build
```

После запуска:
- **Веб-интерфейс:** http://localhost (nginx)
- **API через nginx:** http://localhost/api/users
- **API напрямую:** http://localhost:3000/users

### Stop the Application

```bash
docker-compose down
```

To remove database data:

```bash
docker-compose down -v
```

## Database Migrations

Проект использует [node-pg-migrate](https://github.com/salsita/node-pg-migrate) для управления схемой базы данных.

### Автоматический запуск

Миграции автоматически применяются при запуске backend контейнера.

### Команды миграций

```bash
# Применить все миграции
docker-compose exec backend npm run migrate:up

# Откатить последнюю миграцию
docker-compose exec backend npm run migrate:down

# Создать новую миграцию
docker-compose exec backend npm run migrate:create -- название-миграции
```

### Структура миграции

```javascript
// migrations/TIMESTAMP_название-миграции.js

exports.up = (pgm) => {
  // Изменения схемы (применение)
  pgm.createTable('posts', {
    id: 'id',
    title: { type: 'varchar(255)', notNull: true },
    content: 'text',
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
  });
};

exports.down = (pgm) => {
  // Откат изменений
  pgm.dropTable('posts');
};
```

### Текущие миграции

| Миграция | Описание |
|----------|----------|
| `1701408000000_create-users-table` | Создание таблицы users |
| `1701408001000_seed-initial-users` | Начальные тестовые данные |
| `1701408002000_add-user-phone-column` | Добавление поля phone |

### Таблица истории миграций

Информация о применённых миграциях хранится в таблице `pgmigrations`:

```sql
SELECT * FROM pgmigrations ORDER BY run_on;
```

## Nginx

Nginx выполняет две функции:

### Статические файлы
Раздаёт файлы из папки `frontend/` на порту **80**

### Reverse Proxy
Все запросы `/api/*` проксируются на backend (порт 3000):

| Запрос | Проксируется на |
|--------|-----------------|
| `/api/` | `http://backend:3000/` |
| `/api/users` | `http://backend:3000/users` |

### Порты

| Порт | Сервис | Описание |
|------|--------|----------|
| 80 | nginx | Веб-интерфейс + API прокси |
| 3000 | backend | Node.js API (прямой доступ) |
| 5432 | db | PostgreSQL |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Welcome message with timestamp |
| GET | `/users` | Get all users |
| POST | `/users` | Create a new user |
| PUT | `/users/:id` | Update a user |
| DELETE | `/users/:id` | Delete a user |

## Usage Examples

### Get Welcome Message

```bash
curl http://localhost:3000/
```

### Get All Users

```bash
curl http://localhost:3000/users
```

### Create a User

**Linux/macOS:**

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "phone": "+7-999-123-4567"}'
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/users" -Method Post -ContentType "application/json" -Body '{"name": "John Doe", "email": "john@example.com", "phone": "+7-999-123-4567"}'
```

### Update a User

**Linux/macOS:**

```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "email": "jane@example.com", "phone": "+7-999-765-4321"}'
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/users/1" -Method Put -ContentType "application/json" -Body '{"name": "Jane Doe", "email": "jane@example.com", "phone": "+7-999-765-4321"}'
```

### Delete a User

**Linux/macOS:**

```bash
curl -X DELETE http://localhost:3000/users/1
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/users/1" -Method Delete
```

## Database Access

### Via Command Line

```bash
docker exec -it node-app-db2-db-1 psql -U user -d mydb
```

### Connection Details (for GUI tools)

| Parameter | Value |
|-----------|-------|
| Host | localhost |
| Port | 5432 |
| Database | mydb |
| Username | user |
| Password | password |

### Database Schema

```sql
-- Таблица users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX users_email_index ON users (email);
CREATE INDEX users_phone_index ON users (phone);
```

## Environment Variables

Переменные окружения хранятся в файле `.env`. Для начала работы:

```bash
cp .env.example .env
```

### Доступные переменные

| Variable | Default | Description |
|----------|---------|-------------|
| DB_HOST | db | Database host |
| DB_PORT | 5432 | Database port |
| DB_NAME | mydb | Database name |
| DB_USER | user | Database user |
| DB_PASSWORD | password | Database password |
| NGINX_PORT | 80 | Nginx port |
| BACKEND_PORT | 3000 | Backend API port |
| POSTGRES_PORT | 5432 | PostgreSQL port |

## Health Checks

Все контейнеры настроены с health checks для мониторинга состояния:

| Service | Check | Interval | Retries |
|---------|-------|----------|---------|
| db | `pg_isready` | 10s | 5 |
| backend | HTTP GET localhost:3000 | 30s | 3 |
| nginx | HTTP GET localhost:80 | 30s | 3 |

### Проверка статуса

```bash
docker compose ps
```

### Детальная информация о health check

```bash
docker inspect --format='{{json .State.Health}}' <container_name>
```

### Порядок запуска

Сервисы запускаются с учётом зависимостей:
1. **db** запускается первым
2. **backend** ждёт, пока db станет healthy
3. **nginx** ждёт, пока backend станет healthy

## Development

The backend folder is mounted as a volume, so changes to the source code will be reflected in the container. However, you'll need to restart the container to see the changes (or add nodemon for hot-reload).

### Пересборка после изменения зависимостей

При изменении `package.json` необходимо пересобрать контейнер:

```bash
docker-compose build --no-cache backend
docker-compose up -d -V
```
