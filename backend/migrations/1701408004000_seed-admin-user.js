/**
 * Migration: Seed initial admin user
 * Creates a default admin account for initial system access
 * Default password: admin123 (should be changed immediately after first login)
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

const bcrypt = require('bcrypt');

exports.up = async (pgm) => {
  // Hash the default admin password
  const saltRounds = 10;
  const defaultPassword = 'admin123';
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  // Insert admin user
  pgm.sql(`
    INSERT INTO users (name, email, password_hash, role, is_active, created_at)
    VALUES ('Administrator', 'admin@chronolegal.com', '${passwordHash}', 'admin', true, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      is_active = true;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM users WHERE email = 'admin@chronolegal.com';`);
};

