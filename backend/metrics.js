const client = require('prom-client');

// Создаём реестр метрик
const register = new client.Registry();

// Добавляем метки по умолчанию
register.setDefaultLabels({
  app: 'node-backend',
});

// Собираем стандартные метрики Node.js (CPU, память, event loop и т.д.)
client.collectDefaultMetrics({ register });

// === Кастомные метрики ===

// Счётчик HTTP запросов
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Общее количество HTTP запросов',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Гистограмма времени ответа
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Длительность HTTP запросов в секундах',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

// Счётчик ошибок базы данных
const dbErrorsTotal = new client.Counter({
  name: 'db_errors_total',
  help: 'Общее количество ошибок базы данных',
  labelNames: ['operation'],
  registers: [register],
});

// Gauge для активных соединений БД
const dbActiveConnections = new client.Gauge({
  name: 'db_active_connections',
  help: 'Количество активных соединений с базой данных',
  registers: [register],
});

// Счётчик успешных запросов к БД
const dbQueriesTotal = new client.Counter({
  name: 'db_queries_total',
  help: 'Общее количество запросов к базе данных',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Middleware для сбора метрик HTTP запросов
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;

    // Нормализуем route для метрик (заменяем ID на :id)
    let route = req.route?.path || req.path;
    route = route.replace(/\/\d+/g, '/:id');

    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: res.statusCode,
      },
      durationSeconds
    );
  });

  next();
};

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDuration,
  dbErrorsTotal,
  dbActiveConnections,
  dbQueriesTotal,
};


