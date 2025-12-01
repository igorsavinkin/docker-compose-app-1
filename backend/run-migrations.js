/**
 * Модуль для программного запуска миграций
 */
const { default: migrate } = require('node-pg-migrate');
const path = require('path');

async function runMigrations() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'mydb',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
  };

  console.log('🔄 Запуск миграций базы данных...');
  console.log(`   Хост: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   База данных: ${dbConfig.database}`);

  try {
    await migrate({
      databaseUrl: dbConfig,
      dir: path.join(__dirname, 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      verbose: true,
      log: (msg) => console.log(`   ${msg}`),
    });

    console.log('✅ Миграции успешно применены');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграций:', error.message);
    throw error;
  }
}

module.exports = { runMigrations };

