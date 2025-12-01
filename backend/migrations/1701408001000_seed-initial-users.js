/**
 * Миграция: добавление начальных тестовых данных
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO users (name, email) VALUES 
      ('Иван Иванов', 'ivan@example.com'),
      ('Мария Петрова', 'maria@example.com'),
      ('Алексей Сидоров', 'alexey@example.com')
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM users WHERE email IN (
      'ivan@example.com',
      'maria@example.com',
      'alexey@example.com'
    );
  `);
};

