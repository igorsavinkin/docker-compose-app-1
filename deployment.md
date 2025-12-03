# Deployment Guide

Руководство по развёртыванию Node.js Docker App with PostgreSQL.

## Содержание

- [Требования](#требования)
- [Локальное развёртывание](#локальное-развёртывание)
- [Production развёртывание](#production-развёртывание)
- [Конфигурация окружения](#конфигурация-окружения)
- [База данных и миграции](#база-данных-и-миграции)
- [Мониторинг](#мониторинг)
- [Обновление приложения](#обновление-приложения)
- [Резервное копирование](#резервное-копирование)
- [Troubleshooting](#troubleshooting)

---

## Требования

### Минимальные системные требования

| Ресурс | Development | Production |
|--------|-------------|------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 10 GB | 50+ GB SSD |

### Необходимое ПО

- [Docker](https://www.docker.com/get-started) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+
- Git (для клонирования репозитория)

### Проверка установки

```bash
docker --version
docker compose version
```

---

## Локальное развёртывание

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd node-app-db2
```

### 2. Настройка переменных окружения

```bash
# Создать файл .env из шаблона
cp .env.example .env

# При необходимости отредактировать .env
```

### 3. Запуск приложения

```bash
# Сборка и запуск всех сервисов
docker-compose up --build

# Или в фоновом режиме
docker-compose up --build -d
```

### 4. Проверка работоспособности

```bash
# Статус контейнеров
docker-compose ps

# Health check
curl http://localhost:3000/health

# Проверка API
curl http://localhost/api/users
```

### 5. Доступные URL после запуска

| Сервис | URL | Описание |
|--------|-----|----------|
| Frontend (HTTP) | http://localhost:8080 | Веб-интерфейс |
| Frontend (HTTPS) | https://localhost:8443 | Веб-интерфейс (SSL) |
| API (nginx) | http://localhost:8080/api/users | API через прокси |
| API (direct) | http://localhost:3000/users | API напрямую |
| Prometheus | http://localhost:9090 | Метрики |
| Grafana | http://localhost:3001 | Дашборды (admin/admin) |

### 6. Hot-reload фронтенда

Фронтенд обслуживается через nginx с volume mount:

```yaml
# docker-compose.yml
nginx:
  volumes:
    - ./frontend:/usr/share/nginx/html:ro
```

Это означает, что **изменения в файлах фронтенда применяются мгновенно** — пересборка не требуется!

Просто обновите страницу в браузере:
- **Windows/Linux:** `Ctrl + F5` или `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

Папка `./frontend` монтируется напрямую в nginx, поэтому любые изменения в HTML/CSS/JS файлах видны сразу после обновления страницы.

> 💡 **Совет:** Используйте "жёсткое" обновление (`Ctrl + F5`), чтобы очистить кэш браузера.

---

## Production развёртывание

### Подготовка сервера

#### 1. Установка Docker на Linux (Ubuntu/Debian)

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin -y

# Перезагрузка для применения изменений
sudo reboot
```

#### 2. Настройка firewall

```bash
# Открыть необходимые порты
sudo ufw allow 8080/tcp   # HTTP (nginx)
sudo ufw allow 8443/tcp   # HTTPS (nginx с SSL)
sudo ufw enable
```

> ⚠️ **Важно:** Не открывайте порты 3000, 5432, 9090, 3001 напрямую в production! Доступ к ним должен быть только через внутреннюю сеть Docker или VPN.

### Настройка production окружения

#### 1. Создание .env для production

```bash
# .env (production)

# База данных - используйте СИЛЬНЫЕ пароли!
DB_HOST=db
DB_PORT=5432
DB_NAME=mydb_prod
DB_USER=app_user
DB_PASSWORD=<STRONG_PASSWORD_HERE>

# Порты
NGINX_PORT=80
BACKEND_PORT=3000
POSTGRES_PORT=5432

# Логирование
LOG_LEVEL=warn

# Мониторинг
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_USER=admin
GRAFANA_PASSWORD=<STRONG_PASSWORD_HERE>
```

#### 2. Безопасность production

Создайте `docker-compose.prod.yml` для переопределения настроек:

```yaml
# docker-compose.prod.yml
services:
  backend:
    # Убрать монтирование исходников
    volumes:
      - backend_logs:/app/logs
    # Добавить ограничения ресурсов
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  db:
    # Закрыть внешний доступ к PostgreSQL
    ports: []
    
  prometheus:
    # Закрыть внешний доступ
    ports: []
    
  grafana:
    # Закрыть внешний доступ или настроить через nginx
    ports: []
```

#### 3. Запуск в production

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Настройка HTTPS (SSL/TLS)

Приложение использует порты **8080** (HTTP) и **8443** (HTTPS), чтобы не конфликтовать с другими сервисами на стандартных портах 80/443.

#### Вариант 1: Использование существующего SSL-сертификата (FastPanel / Let's Encrypt)

Если у вас уже есть SSL-сертификат (например, от FastPanel), используйте его:

**Шаг 1: Найти сертификаты на сервере**

```bash
# FastPanel обычно хранит сертификаты здесь:
ls -la /var/www/httpd-cert/yourdomain.com*

# Стандартный Let's Encrypt:
ls -la /etc/letsencrypt/live/yourdomain.com/
```

**Шаг 2: Настроить docker-compose.yml**

Замените пути к сертификатам в разделе nginx volumes:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./frontend:/usr/share/nginx/html:ro
    # Для FastPanel (замените путь на ваш):
    - /var/www/httpd-cert/yourdomain.com_XXXXX.crt:/etc/nginx/ssl/fullchain.pem:ro
    - /var/www/httpd-cert/yourdomain.com_XXXXX.key:/etc/nginx/ssl/privkey.pem:ro
    # Или для стандартного Let's Encrypt:
    # - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
```

**Шаг 3: Включить SSL-конфигурацию nginx**

```bash
cp nginx/nginx-ssl.conf nginx/nginx.conf
```

**Шаг 4: Перезапустить nginx**

```bash
docker compose restart nginx
```

#### Вариант 2: Самоподписанный сертификат (для разработки)

```bash
# Linux/macOS
chmod +x ssl/generate-self-signed.sh
./ssl/generate-self-signed.sh yourdomain.com

# Windows (PowerShell)
.\ssl\generate-self-signed.ps1 -Domain "yourdomain.com"
```

#### Автоматическое обновление сертификатов FastPanel

При обновлении сертификата FastPanel меняет имя файла. Используйте скрипт автообновления:

```bash
# Сделать скрипт исполняемым
chmod +x ssl/update-cert.sh

# Запустить вручную
sudo ./ssl/update-cert.sh

# Добавить в cron для автоматического обновления (каждый день в 3:00)
sudo crontab -e
# Добавить строку:
0 3 * * * /path/to/project/ssl/update-cert.sh >> /var/log/cert-update.log 2>&1
```

#### Использование с Cloudflare

Если вы используете Cloudflare как CDN/proxy:

**1. Настройка DNS в Cloudflare:**
- Добавьте A-запись: `yourdomain.com` → IP вашего сервера
- Включите проксирование (оранжевое облако)

**2. Настройка SSL в Cloudflare:**
- SSL/TLS → Overview → выберите **Full** или **Full (strict)**
- Cloudflare поддерживает порт 8443 для HTTPS

**3. Открыть порт 8443 на сервере:**

```bash
sudo ufw allow 8443/tcp
```

**4. Проверить доступность:**

```bash
# Локально на сервере
curl -k https://localhost:8443

# Через Cloudflare
curl https://yourdomain.com:8443
```

#### Проверка SSL-сертификата

```bash
# Проверить статус сертификата
./ssl/check-cert.sh

# Проверить работу HTTPS
curl -k https://localhost:8443
docker exec <nginx-container> wget -q --spider --no-check-certificate https://localhost:8443
```

#### Порты с SSL

| Порт | Описание |
|------|----------|
| 8080 | HTTP (редирект на HTTPS) |
| 8443 | HTTPS |
| 3000 | Backend API (прямой доступ) |
| 3001 | Grafana |
| 5432 | PostgreSQL |
| 9090 | Prometheus |

---

## Конфигурация окружения

### Все переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DB_HOST` | db | Хост базы данных |
| `DB_PORT` | 5432 | Порт PostgreSQL |
| `DB_NAME` | mydb | Имя базы данных |
| `DB_USER` | user | Пользователь БД |
| `DB_PASSWORD` | password | Пароль БД |
| `NGINX_PORT` | 8080 | HTTP порт nginx |
| `NGINX_SSL_PORT` | 8443 | HTTPS порт nginx |
| `BACKEND_PORT` | 3000 | Порт backend API |
| `POSTGRES_PORT` | 5432 | Внешний порт PostgreSQL |
| `LOG_LEVEL` | info | Уровень логирования |
| `PROMETHEUS_PORT` | 9090 | Порт Prometheus |
| `GRAFANA_PORT` | 3001 | Порт Grafana |
| `GRAFANA_USER` | admin | Логин Grafana |
| `GRAFANA_PASSWORD` | admin | Пароль Grafana |

### Уровни логирования

| Уровень | Использование |
|---------|---------------|
| `error` | Только критические ошибки (production) |
| `warn` | Ошибки и предупреждения (production) |
| `info` | Информационные сообщения (staging) |
| `http` | HTTP запросы (development) |
| `debug` | Отладка (development only) |

---

## База данных и миграции

### Автоматические миграции

Миграции запускаются автоматически при старте backend контейнера.

### Ручное управление миграциями

```bash
# Применить все миграции
docker-compose exec backend npm run migrate:up

# Откатить последнюю миграцию
docker-compose exec backend npm run migrate:down

# Создать новую миграцию
docker-compose exec backend npm run migrate:create -- migration-name
```

### Проверка статуса миграций

```bash
docker-compose exec db psql -U user -d mydb -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

### Текущие миграции

| Миграция | Описание |
|----------|----------|
| `1701408000000_create-users-table` | Создание таблицы users |
| `1701408001000_seed-initial-users` | Начальные тестовые данные |
| `1701408002000_add-user-phone-column` | Добавление поля phone |

---

## Мониторинг

### Проверка состояния сервисов

```bash
# Статус всех контейнеров
docker-compose ps

# Логи всех сервисов
docker-compose logs

# Логи конкретного сервиса в реальном времени
docker-compose logs -f backend

# Health check информация
docker inspect --format='{{json .State.Health}}' node-app-db2-backend-1
```

### Prometheus

**URL:** http://localhost:9090

Примеры запросов PromQL:

```promql
# Запросы в секунду
rate(http_requests_total[5m])

# 95-й перцентиль времени ответа
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Ошибки за час
increase(http_requests_total{status_code=~"5.."}[1h])
```

### Grafana

**URL:** http://localhost:3001  
**Логин:** admin  
**Пароль:** admin (или из .env)

Предустановленный дашборд "Node.js Backend Dashboard" включает:
- HTTP запросы и ошибки
- Время ответа
- Использование памяти и CPU
- Статус соединений с БД

### Алерты (рекомендации)

Настройте алерты в Grafana для:
- Высокий процент ошибок (>1% за 5 минут)
- Время ответа > 1 секунды
- Использование памяти > 80%
- Контейнер unhealthy

---

## Обновление приложения

### Обновление с минимальным простоем

```bash
# 1. Получить последние изменения
git pull origin main

# 2. Пересобрать и перезапустить (rolling update)
docker-compose up -d --build --no-deps backend

# 3. Проверить health
docker-compose ps
curl http://localhost:3000/health
```

### Полное обновление

```bash
# Остановить все сервисы
docker-compose down

# Пересобрать с нуля
docker-compose build --no-cache

# Запустить
docker-compose up -d
```

### Откат к предыдущей версии

```bash
# Откат кода
git checkout <previous-commit>

# Пересобрать и запустить
docker-compose up -d --build

# Откат миграций (если нужно)
docker-compose exec backend npm run migrate:down
```

---

## Резервное копирование

### Backup базы данных

```bash
# Создать dump
docker-compose exec db pg_dump -U user mydb > backup_$(date +%Y%m%d_%H%M%S).sql

# Сжатый backup
docker-compose exec db pg_dump -U user mydb | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление базы данных

```bash
# Из SQL файла
cat backup.sql | docker-compose exec -T db psql -U user mydb

# Из сжатого файла
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U user mydb
```

### Backup volumes

```bash
# Backup всех volumes
docker run --rm -v node-app-db2_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v node-app-db2_prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus_data.tar.gz /data
docker run --rm -v node-app-db2_grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana_data.tar.gz /data
```

### Автоматизация backup (cron)

```bash
# Добавить в crontab
# Ежедневный backup в 3:00
0 3 * * * cd /path/to/project && docker-compose exec -T db pg_dump -U user mydb | gzip > /backup/db_$(date +\%Y\%m\%d).sql.gz
```

---

## Troubleshooting

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs <service-name>

# Проверить health status
docker inspect --format='{{json .State.Health}}' <container-name>
```

### Backend не подключается к БД

```bash
# Проверить, что db контейнер healthy
docker-compose ps

# Проверить сеть
docker-compose exec backend ping db

# Проверить переменные окружения
docker-compose exec backend env | grep DB_
```

### Порт уже занят

```bash
# Найти процесс на порту (Linux/macOS)
sudo lsof -i :80

# Или изменить порт в .env
NGINX_PORT=8080
```

### Очистка и пересоздание

```bash
# Остановить и удалить контейнеры
docker-compose down

# Удалить volumes (ВНИМАНИЕ: удалит данные!)
docker-compose down -v

# Удалить неиспользуемые образы
docker image prune -a

# Полная пересборка
docker-compose build --no-cache
docker-compose up -d
```

### Проблемы с миграциями

```bash
# Проверить статус миграций
docker-compose exec db psql -U user -d mydb -c "SELECT * FROM pgmigrations;"

# Принудительный откат
docker-compose exec backend npm run migrate:down

# Ручной SQL (крайний случай)
docker-compose exec db psql -U user -d mydb
```

### Проверка ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Место на диске
docker system df
```

---

## Команды быстрого доступа

```bash
# Запуск
docker-compose up -d --build

# Остановка
docker-compose down

# Логи
docker-compose logs -f

# Статус
docker-compose ps

# Вход в контейнер
docker-compose exec backend sh
docker-compose exec db psql -U user -d mydb

# Перезапуск сервиса
docker-compose restart backend

# Пересборка сервиса
docker-compose up -d --build --no-deps backend
```

