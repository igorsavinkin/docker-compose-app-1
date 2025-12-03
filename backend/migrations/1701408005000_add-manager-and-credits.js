/**
 * Migration: Add personal manager and credits to users table
 * - manager_id: Foreign key to users.id for personal manager assignment
 * - credits: Integer with default value of 10
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  // Add manager_id column (self-referencing foreign key)
  pgm.addColumns('users', {
    manager_id: {
      type: 'integer',
      notNull: false,
      references: '"users"',
      onDelete: 'SET NULL',
    },
    credits: {
      type: 'integer',
      notNull: true,
      default: 10,
    },
  });

  // Create index on manager_id for faster lookups
  pgm.createIndex('users', 'manager_id');

  // Add constraint to ensure manager_id references a user with role 'manager' or 'admin'
  // Note: This is enforced at application level for flexibility
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'manager_id');
  pgm.dropColumns('users', ['manager_id', 'credits']);
};

