/**
 * Migration: Add authentication fields and roles to users table
 * Adds password_hash, role, password reset functionality, and account status
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  // Create enum type for roles
  pgm.createType('user_role', ['admin', 'manager', 'editor', 'client']);

  // Add authentication and role columns to users table
  pgm.addColumns('users', {
    password_hash: {
      type: 'varchar(255)',
      notNull: false,
    },
    role: {
      type: 'user_role',
      notNull: true,
      default: 'client',
    },
    password_reset_token: {
      type: 'varchar(255)',
      notNull: false,
    },
    password_reset_expires: {
      type: 'timestamp',
      notNull: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    last_login: {
      type: 'timestamp',
      notNull: false,
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Make email unique and not null for authentication
  pgm.alterColumn('users', 'email', {
    notNull: true,
  });

  // Create unique index on email
  pgm.createIndex('users', 'email', { unique: true, name: 'users_email_unique' });

  // Create index on role for filtering
  pgm.createIndex('users', 'role');

  // Create index on password_reset_token for lookup
  pgm.createIndex('users', 'password_reset_token');
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'password_reset_token');
  pgm.dropIndex('users', 'role');
  pgm.dropIndex('users', 'email', { name: 'users_email_unique' });
  
  pgm.alterColumn('users', 'email', {
    notNull: false,
  });

  pgm.dropColumns('users', [
    'password_hash',
    'role',
    'password_reset_token',
    'password_reset_expires',
    'is_active',
    'last_login',
    'updated_at',
  ]);

  pgm.dropType('user_role');
};

