/**
 * Миграция: создание таблицы users
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: false,
    },
    email: {
      type: 'varchar(100)',
      notNull: false,
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  }, {
    ifNotExists: true,
  });

  // Добавляем индекс на email для быстрого поиска
  pgm.createIndex('users', 'email', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};

