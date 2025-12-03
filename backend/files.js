const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// File storage configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default

// Allowed MIME types for documents
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

// Create files router
function createFilesRouter(pool, logger, dbQuery, authenticateToken, requireRole) {
  const router = express.Router();

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info('Upload directory created', { path: UPLOAD_DIR });
  }

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Create user-specific directory
      const userDir = path.join(UPLOAD_DIR, String(req.user.id));
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const ext = path.extname(file.originalname);
      const uniqueName = `${uuidv4()}${ext}`;
      cb(null, uniqueName);
    }
  });

  // File filter for validation
  const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
    }
  });

  // === Helper: Check if user can access another user's files ===
  const canAccessUserFiles = (requestingUser, targetUserId) => {
    // Users can always access their own files
    if (requestingUser.id === targetUserId) {
      return true;
    }

    // Admins can access all files
    if (requestingUser.role === 'admin') {
      return true;
    }

    // Managers can access their assigned clients' files
    if (requestingUser.role === 'manager') {
      // Will be checked against manager_id in database
      return 'check_manager';
    }

    // Editors can access clients' files (they work with documents)
    if (requestingUser.role === 'editor') {
      return true;
    }

    return false;
  };

  // === Upload file ===
  router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { description } = req.body;
      const file = req.file;

      // Save file metadata to database
      const result = await dbQuery(
        `INSERT INTO files (filename, original_name, mime_type, size, path, owner_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, filename, original_name, mime_type, size, description, created_at`,
        [
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          file.path,
          req.user.id,
          description || null
        ],
        'upload_file'
      );

      logger.info('File uploaded', {
        fileId: result.rows[0].id,
        userId: req.user.id,
        originalName: file.originalname,
        size: file.size
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        file: result.rows[0]
      });

    } catch (err) {
      // Clean up file if database insert fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      logger.error('File upload error', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // === Upload multiple files ===
  router.post('/upload-multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
    const uploadedFiles = [];
    const failedFiles = [];

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      for (const file of req.files) {
        try {
          const result = await dbQuery(
            `INSERT INTO files (filename, original_name, mime_type, size, path, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, filename, original_name, mime_type, size, created_at`,
            [
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              file.path,
              req.user.id
            ],
            'upload_multiple_files'
          );
          uploadedFiles.push(result.rows[0]);
        } catch (err) {
          failedFiles.push({ name: file.originalname, error: err.message });
          // Clean up failed file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      logger.info('Multiple files uploaded', {
        userId: req.user.id,
        successCount: uploadedFiles.length,
        failedCount: failedFiles.length
      });

      res.status(201).json({
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        files: uploadedFiles,
        failed: failedFiles
      });

    } catch (err) {
      logger.error('Multiple file upload error', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Failed to upload files' });
    }
  });

  // === List user's own files ===
  router.get('/my-files', authenticateToken, async (req, res) => {
    try {
      const result = await dbQuery(
        `SELECT id, filename, original_name, mime_type, size, description, created_at, updated_at
         FROM files
         WHERE owner_id = $1 AND is_deleted = false
         ORDER BY created_at DESC`,
        [req.user.id],
        'get_my_files'
      );

      res.json(result.rows);

    } catch (err) {
      logger.error('Error fetching user files', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  // === List files by user ID (for managers/admins/editors) ===
  router.get('/user/:userId', authenticateToken, requireRole('admin', 'manager', 'editor'), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);

    try {
      // Check access permissions
      const accessCheck = canAccessUserFiles(req.user, targetUserId);

      if (accessCheck === 'check_manager') {
        // Verify manager is assigned to this client
        const clientCheck = await dbQuery(
          'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
          [targetUserId, req.user.id],
          'check_manager_client'
        );

        if (clientCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied. User is not your assigned client.' });
        }
      } else if (!accessCheck) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get user info
      const userResult = await dbQuery(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [targetUserId],
        'get_user_for_files'
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's files
      const filesResult = await dbQuery(
        `SELECT id, filename, original_name, mime_type, size, description, created_at, updated_at
         FROM files
         WHERE owner_id = $1 AND is_deleted = false
         ORDER BY created_at DESC`,
        [targetUserId],
        'get_user_files'
      );

      logger.info('Files accessed by staff', {
        accessedBy: req.user.id,
        targetUser: targetUserId,
        fileCount: filesResult.rows.length
      });

      res.json({
        user: userResult.rows[0],
        files: filesResult.rows
      });

    } catch (err) {
      logger.error('Error fetching user files', { targetUserId, error: err.message });
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  // === List all clients with files (for managers/admins/editors) ===
  router.get('/all-clients', authenticateToken, requireRole('admin', 'manager', 'editor'), async (req, res) => {
    try {
      let query;
      let params = [];

      if (req.user.role === 'admin' || req.user.role === 'editor') {
        // Admins and editors can see all clients with files
        query = `
          SELECT u.id, u.name, u.email, u.role,
                 COUNT(f.id) as file_count,
                 MAX(f.created_at) as last_upload
          FROM users u
          LEFT JOIN files f ON u.id = f.owner_id AND f.is_deleted = false
          WHERE u.role = 'client'
          GROUP BY u.id
          ORDER BY last_upload DESC NULLS LAST, u.name ASC
        `;
      } else if (req.user.role === 'manager') {
        // Managers can only see their assigned clients
        query = `
          SELECT u.id, u.name, u.email, u.role,
                 COUNT(f.id) as file_count,
                 MAX(f.created_at) as last_upload
          FROM users u
          LEFT JOIN files f ON u.id = f.owner_id AND f.is_deleted = false
          WHERE u.manager_id = $1 AND u.role = 'client'
          GROUP BY u.id
          ORDER BY last_upload DESC NULLS LAST, u.name ASC
        `;
        params = [req.user.id];
      }

      const result = await dbQuery(query, params, 'get_all_clients_files');

      res.json(result.rows);

    } catch (err) {
      logger.error('Error fetching clients list', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  // === Download file ===
  router.get('/download/:fileId', authenticateToken, async (req, res) => {
    const fileId = parseInt(req.params.fileId);

    try {
      // Get file info
      const result = await dbQuery(
        `SELECT f.*, u.manager_id as owner_manager_id
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.id = $1 AND f.is_deleted = false`,
        [fileId],
        'get_file_for_download'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const file = result.rows[0];

      // Check access permissions
      const accessCheck = canAccessUserFiles(req.user, file.owner_id);

      if (accessCheck === 'check_manager') {
        if (file.owner_manager_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (!accessCheck) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if file exists on disk
      if (!fs.existsSync(file.path)) {
        logger.error('File not found on disk', { fileId, path: file.path });
        return res.status(404).json({ error: 'File not found on disk' });
      }

      logger.info('File downloaded', {
        fileId,
        downloadedBy: req.user.id,
        ownerId: file.owner_id
      });

      // Send file
      res.download(file.path, file.original_name);

    } catch (err) {
      logger.error('File download error', { fileId, error: err.message });
      res.status(500).json({ error: 'Failed to download file' });
    }
  });

  // === Delete file (soft delete) ===
  router.delete('/:fileId', authenticateToken, async (req, res) => {
    const fileId = parseInt(req.params.fileId);

    try {
      // Get file info
      const result = await dbQuery(
        'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
        [fileId],
        'get_file_for_delete'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const file = result.rows[0];

      // Only owner or admin can delete files
      if (file.owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Only owner or admin can delete files.' });
      }

      // Soft delete
      await dbQuery(
        'UPDATE files SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [fileId],
        'soft_delete_file'
      );

      logger.info('File deleted', {
        fileId,
        deletedBy: req.user.id,
        ownerId: file.owner_id
      });

      res.json({ message: 'File deleted successfully' });

    } catch (err) {
      logger.error('File delete error', { fileId, error: err.message });
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // === Update file description ===
  router.put('/:fileId', authenticateToken, async (req, res) => {
    const fileId = parseInt(req.params.fileId);
    const { description } = req.body;

    try {
      // Get file info
      const result = await dbQuery(
        'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
        [fileId],
        'get_file_for_update'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const file = result.rows[0];

      // Only owner can update file metadata
      if (file.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. Only owner can update file.' });
      }

      // Update
      const updateResult = await dbQuery(
        `UPDATE files SET description = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, filename, original_name, mime_type, size, description, created_at, updated_at`,
        [description || null, fileId],
        'update_file'
      );

      res.json({
        message: 'File updated successfully',
        file: updateResult.rows[0]
      });

    } catch (err) {
      logger.error('File update error', { fileId, error: err.message });
      res.status(500).json({ error: 'Failed to update file' });
    }
  });

  // === Get file info ===
  router.get('/:fileId', authenticateToken, async (req, res) => {
    const fileId = parseInt(req.params.fileId);

    try {
      const result = await dbQuery(
        `SELECT f.*, u.name as owner_name, u.email as owner_email, u.manager_id as owner_manager_id
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.id = $1 AND f.is_deleted = false`,
        [fileId],
        'get_file_info'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const file = result.rows[0];

      // Check access
      const accessCheck = canAccessUserFiles(req.user, file.owner_id);

      if (accessCheck === 'check_manager') {
        if (file.owner_manager_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (!accessCheck) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Remove sensitive fields
      delete file.path;
      delete file.owner_manager_id;

      res.json(file);

    } catch (err) {
      logger.error('Get file info error', { fileId, error: err.message });
      res.status(500).json({ error: 'Failed to get file info' });
    }
  });

  // Error handling middleware for multer
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (err.message && err.message.includes('File type')) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  });

  return router;
}

module.exports = { createFilesRouter, ALLOWED_MIME_TYPES, MAX_FILE_SIZE };

