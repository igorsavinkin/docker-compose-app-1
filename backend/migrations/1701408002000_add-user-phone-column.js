/**
 * Миграция: добавление колонки phone в таблицу users
 * Пример дополнительной миграции для расширения схемы
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  pgm.addColumn('users', {
    phone: {
      type: 'varchar(20)',
      notNull: false,
    },
  });

  // Добавляем индекс на phone
  pgm.createIndex('users', 'phone');
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'phone');
};


