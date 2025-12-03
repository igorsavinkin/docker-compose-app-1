/**
 * Migration: Create files table for document management
 * Stores file metadata with owner references and access control
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  // Create files table
  pgm.createTable('files', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    filename: {
      type: 'varchar(255)',
      notNull: true,
    },
    original_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    size: {
      type: 'bigint',
      notNull: true,
    },
    path: {
      type: 'varchar(500)',
      notNull: true,
    },
    owner_id: {
      type: 'integer',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    description: {
      type: 'text',
      notNull: false,
    },
    is_deleted: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for efficient queries
  pgm.createIndex('files', 'owner_id');
  pgm.createIndex('files', 'created_at');
  pgm.createIndex('files', 'is_deleted');
  
  // Composite index for listing user files
  pgm.createIndex('files', ['owner_id', 'is_deleted', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('files');
};

