const express = require('express');
const morgan = require('morgan');
const { Pool } = require('pg');
const { runMigrations } = require('./run-migrations');
const logger = require('./logger');
const { register, metricsMiddleware, dbErrorsTotal, dbActiveConnections, dbQueriesTotal } = require('./metrics');
const { createAuthRouter } = require('./auth');

const app = express();
const port = 3000;

// Конфигурация базы данных
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mydb',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
});

// Мониторинг соединений пула БД
pool.on('connect', () => {
  dbActiveConnections.inc();
  logger.debug('Новое соединение с БД установлено');
});

pool.on('remove', () => {
  dbActiveConnections.dec();
  logger.debug('Соединение с БД закрыто');
});

pool.on('error', (err) => {
  logger.error('Ошибка пула соединений БД', { error: err.message });
  dbErrorsTotal.inc({ operation: 'pool' });
});

// Обёртка для запросов к БД с логированием и метриками
async function dbQuery(text, params, operation = 'query') {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Выполнен SQL запрос', { operation, duration: `${duration}ms`, rows: result.rowCount });
    dbQueriesTotal.inc({ operation, status: 'success' });
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Ошибка SQL запроса', { operation, duration: `${duration}ms`, error: err.message });
    dbQueriesTotal.inc({ operation, status: 'error' });
    dbErrorsTotal.inc({ operation });
    throw err;
  }
}

// Middleware
app.use(express.json());
app.use(metricsMiddleware);

// HTTP логирование через morgan -> winston
app.use(morgan('combined', { stream: logger.stream }));

// Подключение роутера аутентификации
const { router: authRouter, authenticateToken, requireRole, ROLES } = createAuthRouter(pool, logger, dbQuery);
app.use('/auth', authRouter);

// Инициализация базы данных через миграции
async function initializeDatabase() {
  try {
    await runMigrations();
    logger.info('База данных инициализирована с миграциями');
  } catch (err) {
    logger.error('Ошибка инициализации базы данных', { error: err.message, stack: err.stack });
  }
}

// === Маршруты ===

// Главная страница
app.get('/', (req, res) => {
  logger.info('Запрос к главной странице', { ip: req.ip });
  res.json({ 
    message: 'Добро пожаловать в Docker приложение!',
    timestamp: new Date().toISOString()
  });
});

// Эндпоинт метрик для Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Ошибка получения метрик', { error: err.message });
    res.status(500).end(err.message);
  }
});

// Health check эндпоинт
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ 
      status: 'unhealthy', 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Получить всех пользователей
app.get('/users', async (req, res) => {
  try {
    logger.info('Запрос списка пользователей');
    const result = await dbQuery('SELECT * FROM users ORDER BY id', [], 'select_users');
    logger.info('Пользователи получены', { count: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    logger.error('Ошибка получения пользователей', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Добавить пользователя
app.post('/users', async (req, res) => {
  const { name, email, phone } = req.body;
  logger.info('Создание пользователя', { name, email });
  try {
    const result = await dbQuery(
      'INSERT INTO users (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone || null],
      'insert_user'
    );
    logger.info('Пользователь создан', { id: result.rows[0].id, name, email });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Ошибка создания пользователя', { name, email, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Обновить пользователя
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  logger.info('Обновление пользователя', { id, name, email });
  try {
    const result = await dbQuery(
      'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *',
      [name, email, phone || null, id],
      'update_user'
    );
    if (result.rows.length === 0) {
      logger.warn('Пользователь не найден для обновления', { id });
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    logger.info('Пользователь обновлён', { id, name, email });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Ошибка обновления пользователя', { id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Удалить пользователя
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  logger.info('Удаление пользователя', { id });
  try {
    const result = await dbQuery('DELETE FROM users WHERE id = $1 RETURNING *', [id], 'delete_user');
    if (result.rows.length === 0) {
      logger.warn('Пользователь не найден для удаления', { id });
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    logger.info('Пользователь удалён', { id, name: result.rows[0].name });
    res.json({ message: 'Пользователь удалён', user: result.rows[0] });
  } catch (err) {
    logger.error('Ошибка удаления пользователя', { id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.toString(), promise });
});

// Инициализация и запуск сервера
initializeDatabase().then(() => {
  app.listen(port, () => {
    logger.info(`Сервер запущен на http://localhost:${port}`);
    logger.info('Метрики доступны на /metrics');
    logger.info('Health check доступен на /health');
  });
});
