const winston = require('winston');

// Определяем уровень логирования из переменной окружения
const logLevel = process.env.LOG_LEVEL || 'info';

// Форматирование для консоли (с цветами)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Форматирование для файлов (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Создаём логгер
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'backend-api' },
  transports: [
    // Консольный вывод
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Файл для всех логов
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Файл только для ошибок
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Stream для morgan (HTTP логирование)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;


