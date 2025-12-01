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
    └── init.sql
```

## Tech Stack

- **Runtime:** Node.js 16 (Alpine)
- **Framework:** Express.js
- **Database:** PostgreSQL 13
- **Web Server:** Nginx (Alpine)
- **Containerization:** Docker & Docker Compose

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
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/users" -Method Post -ContentType "application/json" -Body '{"name": "John Doe", "email": "john@example.com"}'
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

## Development

The backend folder is mounted as a volume, so changes to the source code will be reflected in the container. However, you'll need to restart the container to see the changes (or add nodemon for hot-reload).

## License

MIT

