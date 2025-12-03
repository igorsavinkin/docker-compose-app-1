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
│   ├── nginx.conf            # Конфигурация nginx (HTTP)
│   └── nginx-ssl.conf        # Конфигурация nginx (HTTPS)
├── ssl/
│   ├── generate-self-signed.sh   # Self-signed cert (Linux/macOS)
│   ├── generate-self-signed.ps1  # Self-signed cert (Windows)
│   ├── init-letsencrypt.sh       # Let's Encrypt (Linux/macOS)
│   └── init-letsencrypt.ps1      # Let's Encrypt (Windows)
├── certbot/                  # SSL certificates (auto-created)
├── frontend/
│   └── index.html            # Статический фронтенд
├── monitoring/               # Логирование и мониторинг
│   ├── prometheus/
│   │   └── prometheus.yml    # Конфигурация Prometheus
│   └── grafana/
│       ├── provisioning/     # Автоконфигурация Grafana
│       │   ├── datasources/
│       │   └── dashboards/
│       └── dashboards/       # JSON дашборды
│           └── nodejs-backend.json
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── server.js
    ├── auth.js               # Модуль аутентификации (JWT, роли)
    ├── files.js              # Модуль управления файлами
    ├── logger.js             # Модуль логирования (Winston)
    ├── metrics.js            # Модуль метрик (Prometheus)
    ├── init.sql
    ├── migrate-config.js     # Конфигурация миграций
    ├── run-migrations.js     # Модуль запуска миграций
    └── migrations/           # Миграции базы данных
        ├── 1701408000000_create-users-table.js
        ├── 1701408001000_seed-initial-users.js
        ├── 1701408002000_add-user-phone-column.js
        ├── 1701408003000_add-auth-and-roles.js
        ├── 1701408004000_seed-admin-user.js
        ├── 1701408005000_add-manager-and-credits.js
        └── 1701408006000_create-files-table.js
```

## Tech Stack

- **Runtime:** Node.js 16 (Alpine)
- **Framework:** Express.js
- **Database:** PostgreSQL 13
- **Migrations:** node-pg-migrate
- **Authentication:** JWT (jsonwebtoken) + bcrypt
- **File Uploads:** Multer
- **Web Server:** Nginx (Alpine)
- **Containerization:** Docker & Docker Compose
- **Logging:** Winston + Morgan
- **Monitoring:** Prometheus + Grafana
- **Health checks:** для всех сервисов

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### Run the Application

```bash
docker-compose up --build
```

После запуска:
- **Веб-интерфейс:** http://localhost:8080 (nginx)
- **API через nginx:** http://localhost:8080/api/users
- **API напрямую:** http://localhost:3000/users
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin/admin)

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
| `1701408003000_add-auth-and-roles` | Аутентификация и роли (admin, manager, editor, client) |
| `1701408004000_seed-admin-user` | Создание админа (admin@chronolegal.com / admin123) |
| `1701408005000_add-manager-and-credits` | Добавление manager_id и credits для клиентов |
| `1701408006000_create-files-table` | Создание таблицы files для документов |

### Таблица истории миграций

Информация о применённых миграциях хранится в таблице `pgmigrations`:

```sql
SELECT * FROM pgmigrations ORDER BY run_on;
```

## Nginx

Nginx выполняет две функции:

### Статические файлы
Раздаёт файлы из папки `frontend/` на порту **8080** (HTTPS на **8443**)

### Reverse Proxy
Все запросы `/api/*` проксируются на backend (порт 3000):

| Запрос | Проксируется на |
|--------|-----------------|
| `/api/` | `http://backend:3000/` |
| `/api/users` | `http://backend:3000/users` |

### Порты

| Порт | Сервис | Описание |
|------|--------|----------|
| 8080 | nginx | HTTP: Веб-интерфейс + API прокси |
| 8443 | nginx | HTTPS: Веб-интерфейс + API прокси |
| 3000 | backend | Node.js API (прямой доступ) |
| 3001 | grafana | Мониторинг (визуализация) |
| 5432 | db | PostgreSQL |
| 9090 | prometheus | Сбор метрик |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Welcome message with timestamp |
| GET | `/health` | Health check с информацией о состоянии |
| GET | `/metrics` | Prometheus метрики |
| GET | `/users` | Get all users |
| POST | `/users` | Create a new user |
| PUT | `/users/:id` | Update a user |
| DELETE | `/users/:id` | Delete a user |

## File Management

The application includes a comprehensive file management system that allows users to upload documents and enables staff (managers, admins, editors) to access client files.

### Features

- **Upload files**: Users can upload documents (PDF, Word, Excel, images, etc.)
- **Multiple file upload**: Up to 10 files at once
- **File preview**: View file details before downloading
- **Access control**: Role-based access to client files
- **Soft delete**: Files are marked as deleted but can be recovered

### Access Control Rules

| Role | Own Files | Client Files |
|------|-----------|--------------|
| Client | Upload, View, Download, Delete | - |
| Editor | Upload, View, Download, Delete | View, Download (all clients) |
| Manager | Upload, View, Download, Delete | View, Download (assigned clients only) |
| Admin | Upload, View, Download, Delete | View, Download, Delete (all clients) |

### File API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/files/upload` | All users | Upload single file |
| POST | `/files/upload-multiple` | All users | Upload multiple files (max 10) |
| GET | `/files/my-files` | All users | List current user's files |
| GET | `/files/user/:userId` | Admin, Manager, Editor | List specific user's files |
| GET | `/files/all-clients` | Admin, Manager, Editor | List all clients with file counts |
| GET | `/files/download/:fileId` | Authorized | Download a file |
| GET | `/files/:fileId` | Authorized | Get file details |
| PUT | `/files/:fileId` | Owner only | Update file description |
| DELETE | `/files/:fileId` | Owner or Admin | Soft delete a file |

### Supported File Types

| Category | Extensions |
|----------|------------|
| Documents | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, RTF |
| Images | JPEG, PNG, GIF, WebP, TIFF |
| Archives | ZIP, RAR, 7Z |

### File Upload Limits

| Parameter | Value |
|-----------|-------|
| Max file size | 50 MB |
| Max files per upload | 10 |

### Usage Examples

#### Upload a File

**Linux/macOS:**

```bash
curl -X POST http://localhost:8080/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "description=Important contract"
```

**PowerShell:**

```powershell
$headers = @{ "Authorization" = "Bearer YOUR_TOKEN" }
$form = @{
    file = Get-Item -Path "C:\path\to\document.pdf"
    description = "Important contract"
}
Invoke-RestMethod -Uri "http://localhost:8080/api/files/upload" -Method Post -Headers $headers -Form $form
```

#### Get My Files

```bash
curl -X GET http://localhost:8080/api/files/my-files \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Download a File

```bash
curl -X GET http://localhost:8080/api/files/download/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_file.pdf
```

#### List Client Files (Admin/Manager/Editor)

```bash
curl -X GET http://localhost:8080/api/files/user/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### File Storage

Files are stored in a Docker volume (`uploads_data`) to persist data across container restarts. Each user's files are organized in separate directories by user ID.

```
/app/uploads/
├── 1/           # User ID 1's files
│   ├── abc123.pdf
│   └── def456.docx
├── 2/           # User ID 2's files
│   └── ghi789.png
└── ...
```

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
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role user_role DEFAULT 'client',  -- admin, manager, editor, client
    is_active BOOLEAN DEFAULT true,
    manager_id INTEGER REFERENCES users(id),
    credits INTEGER DEFAULT 10,
    last_login TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица files
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    path VARCHAR(500) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX users_email_index ON users (email);
CREATE INDEX users_phone_index ON users (phone);
CREATE INDEX users_role_index ON users (role);
CREATE INDEX files_owner_id_index ON files (owner_id);
CREATE INDEX files_created_at_index ON files (created_at);
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
| NGINX_PORT | 8080 | Nginx HTTP port |
| NGINX_SSL_PORT | 8443 | Nginx HTTPS port |
| BACKEND_PORT | 3000 | Backend API port |
| POSTGRES_PORT | 5432 | PostgreSQL port |
| LOG_LEVEL | info | Уровень логирования (error/warn/info/http/debug) |
| PROMETHEUS_PORT | 9090 | Prometheus port |
| GRAFANA_PORT | 3001 | Grafana port |
| GRAFANA_USER | admin | Grafana admin username |
| GRAFANA_PASSWORD | admin | Grafana admin password |

## Health Checks

Все контейнеры настроены с health checks для мониторинга состояния:

| Service | Check | Interval | Retries |
|---------|-------|----------|---------|
| db | `pg_isready` | 10s | 5 |
| backend | HTTP GET localhost:3000/health | 30s | 3 |
| nginx | HTTP GET localhost:8080 | 30s | 3 |
| prometheus | HTTP GET localhost:9090/-/healthy | 30s | 3 |
| grafana | HTTP GET localhost:3000/api/health | 30s | 3 |

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
4. **prometheus** запускается параллельно
5. **grafana** ждёт prometheus

## Логирование и Мониторинг

### Логирование (Winston + Morgan)

Приложение использует **Winston** для структурированного логирования и **Morgan** для HTTP-логов.

#### Уровни логирования

| Уровень | Описание |
|---------|----------|
| error | Критические ошибки |
| warn | Предупреждения |
| info | Информационные сообщения (по умолчанию) |
| http | HTTP запросы |
| debug | Отладочная информация |

#### Конфигурация

Уровень логирования задаётся через переменную окружения:

```bash
LOG_LEVEL=debug docker-compose up
```

#### Файлы логов

Логи сохраняются в volume `backend_logs`:

| Файл | Содержимое |
|------|------------|
| `logs/combined.log` | Все логи (JSON формат) |
| `logs/error.log` | Только ошибки |

#### Просмотр логов

```bash
# Логи в реальном времени
docker-compose logs -f backend

# Файл логов
docker-compose exec backend cat logs/combined.log
```

### Мониторинг (Prometheus + Grafana)

#### Prometheus

Сбор и хранение метрик. Доступен на http://localhost:9090

**Конфигурация:** `monitoring/prometheus/prometheus.yml`

#### Grafana

Визуализация метрик. Доступен на http://localhost:3001

| Параметр | Значение по умолчанию |
|----------|----------------------|
| Логин | admin |
| Пароль | admin |

При первом входе можно изменить пароль или пропустить.

### Метрики приложения

#### API Endpoint

```
GET /metrics
```

Возвращает метрики в формате Prometheus.

#### Доступные метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `http_requests_total` | Counter | Общее количество HTTP запросов |
| `http_request_duration_seconds` | Histogram | Время ответа на запросы |
| `db_queries_total` | Counter | Количество запросов к БД |
| `db_errors_total` | Counter | Количество ошибок БД |
| `db_active_connections` | Gauge | Активные соединения с БД |
| `nodejs_*` | Various | Стандартные метрики Node.js |
| `process_*` | Various | Метрики процесса |

#### Примеры запросов PromQL

```promql
# Запросов в секунду
rate(http_requests_total[5m])

# 95-й перцентиль времени ответа
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Количество ошибок за последний час
increase(http_requests_total{status_code=~"5.."}[1h])

# Использование памяти
process_resident_memory_bytes
```

### Дашборд Grafana

Предустановленный дашборд "Node.js Backend Dashboard" включает:

- 📊 HTTP запросов за 5 минут
- ❌ Ошибки базы данных
- 💾 Использование памяти (RSS)
- 🔗 Активные соединения БД
- 📈 Запросы в секунду по маршрутам
- ⏱️ Время ответа (95-й перцентиль)
- 🖥️ CPU Usage
- 📉 Node.js Heap Memory
- 📊 HTTP статусы ответов

### Health Check

Расширенный эндпоинт для проверки состояния:

```bash
curl http://localhost:3000/health
```

Ответ:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "rss": 50331648,
    "heapTotal": 18890752,
    "heapUsed": 12345678
  }
}
```

### Порты мониторинга

| Порт | Сервис | Описание |
|------|--------|----------|
| 9090 | Prometheus | Сбор метрик |
| 3001 | Grafana | Визуализация |
| 3000/metrics | Backend | Endpoint метрик |

## SSL/HTTPS Setup

This project supports HTTPS on **port 8443** (HTTP on port 8080) to avoid conflicts with other services.

### Option 1: Self-Signed Certificate (Quick & Easy)

Self-signed certificates provide encryption but browsers will show a warning. Good for development or internal use.

#### Step 1: Generate Certificate

**Windows (PowerShell):**
```powershell
.\ssl\generate-self-signed.ps1 -Domain "yourdomain.com"
```

**Linux/macOS:**
```bash
chmod +x ssl/generate-self-signed.sh
./ssl/generate-self-signed.sh yourdomain.com
```

#### Step 2: Enable HTTPS in Nginx

```powershell
# Copy SSL config
Copy-Item nginx\nginx-ssl.conf nginx\nginx.conf

# Edit and replace YOUR_DOMAIN with your domain
notepad nginx\nginx.conf
```

#### Step 3: Restart Nginx

```bash
docker compose restart nginx
```

Access your app at `https://yourdomain.com:8443` (accept the browser warning).

---

### Option 2: Let's Encrypt (Free Trusted Certificate)

For publicly trusted certificates without browser warnings.

> **Note:** Let's Encrypt requires port 80 for HTTP challenge. Since port 80 is occupied, you have two options:

#### Option 2a: DNS Challenge (Recommended)

If your DNS provider has an API (Cloudflare, Route53, etc.):

```bash
# Run certbot with DNS challenge
docker compose run --rm certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d yourdomain.com \
    -d www.yourdomain.com

# Follow the prompts to add DNS TXT records
```

#### Option 2b: Proxy ACME Challenge

Configure your existing app on port 80 to proxy `/.well-known/acme-challenge/` to this app:

```nginx
# In your existing nginx on port 80
location /.well-known/acme-challenge/ {
    proxy_pass http://localhost:8080/.well-known/acme-challenge/;
}
```

Then run the Let's Encrypt script:

**Windows:**
```powershell
.\ssl\init-letsencrypt.ps1
```

**Linux/macOS:**
```bash
./ssl/init-letsencrypt.sh
```

---

### SSL Configuration Files

| File | Description |
|------|-------------|
| `ssl/generate-self-signed.sh` | Self-signed cert generator (Linux/macOS) |
| `ssl/generate-self-signed.ps1` | Self-signed cert generator (Windows) |
| `ssl/init-letsencrypt.sh` | Let's Encrypt script (Linux/macOS) |
| `ssl/init-letsencrypt.ps1` | Let's Encrypt script (Windows) |
| `nginx/nginx.conf` | Current nginx config (HTTP on 8080) |
| `nginx/nginx-ssl.conf` | SSL nginx config (HTTPS on 8443) |
| `certbot/` | Certificate storage (auto-created, gitignored) |

### Certificate Auto-Renewal

The Certbot container automatically renews Let's Encrypt certificates. It checks every 12 hours, and Nginx reloads every 6 hours.

### Ports

| Port | Service | Description |
|------|---------|-------------|
| 8080 | nginx | HTTP |
| 8443 | nginx | HTTPS |
| 3000 | backend | Node.js API (direct access) |
| 3001 | grafana | Monitoring |
| 5432 | db | PostgreSQL |
| 9090 | prometheus | Metrics |

## Development

The backend folder is mounted as a volume, so changes to the source code will be reflected in the container. However, you'll need to restart the container to see the changes (or add nodemon for hot-reload).

### Пересборка после изменения зависимостей

При изменении `package.json` необходимо пересобрать контейнер:

```bash
docker-compose build --no-cache backend
docker-compose up -d -V
```
