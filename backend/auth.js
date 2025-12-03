const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

// JWT Secret (в продакшене использовать переменную окружения)
const JWT_SECRET = process.env.JWT_SECRET || 'chronolegal-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

// Роли и их уровни доступа
const ROLES = {
  admin: 4,    // Полный доступ, управление ролями
  manager: 3,  // Управление проектами, редакторами, пользователями
  editor: 2,   // Редактирование файлов
  client: 1    // Базовый доступ
};

// Создание auth роутера с доступом к pool и logger
function createAuthRouter(pool, logger, dbQuery) {
  
  // === Middleware для проверки JWT ===
  const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const result = await dbQuery(
        'SELECT id, name, email, role, is_active, manager_id, credits FROM users WHERE id = $1',
        [decoded.userId],
        'get_user_for_auth'
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }

      if (!result.rows[0].is_active) {
        return res.status(403).json({ error: 'Аккаунт деактивирован' });
      }

      req.user = result.rows[0];
      next();
    } catch (err) {
      logger.error('Ошибка проверки токена', { error: err.message });
      return res.status(403).json({ error: 'Недействительный токен' });
    }
  };

  // === Middleware для проверки роли ===
  const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Попытка доступа без достаточных прав', { 
          userId: req.user.id, 
          userRole: req.user.role, 
          requiredRoles: allowedRoles 
        });
        return res.status(403).json({ error: 'Недостаточно прав доступа' });
      }

      next();
    };
  };

  // === Helper: Auto-assign a manager to new client ===
  const assignManager = async () => {
    // Find a manager with the least number of assigned clients
    const result = await dbQuery(
      `SELECT u.id 
       FROM users u 
       WHERE u.role IN ('manager', 'admin') AND u.is_active = true
       ORDER BY (
         SELECT COUNT(*) FROM users c WHERE c.manager_id = u.id
       ) ASC, u.created_at ASC
       LIMIT 1`,
      [],
      'find_available_manager'
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  };

  // === Регистрация нового пользователя ===
  router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    try {
      // Проверяем, не существует ли пользователь
      const existingUser = await dbQuery(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()],
        'check_existing_user'
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }

      // Хэшируем пароль
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Auto-assign a manager to the new client
      const managerId = await assignManager();

      // Создаём пользователя с ролью client по умолчанию, 10 credits, and assigned manager
      const result = await dbQuery(
        `INSERT INTO users (name, email, phone, password_hash, role, is_active, manager_id, credits, created_at)
         VALUES ($1, $2, $3, $4, 'client', true, $5, 10, CURRENT_TIMESTAMP)
         RETURNING id, name, email, role, manager_id, credits, created_at`,
        [name, email.toLowerCase(), phone || null, passwordHash, managerId],
        'register_user'
      );

      const user = result.rows[0];

      // Генерируем JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      logger.info('Новый пользователь зарегистрирован', { 
        userId: user.id, 
        email: user.email,
        managerId: user.manager_id,
        credits: user.credits
      });

      res.status(201).json({
        message: 'Регистрация успешна',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          manager_id: user.manager_id,
          credits: user.credits
        },
        token
      });

    } catch (err) {
      logger.error('Ошибка регистрации', { email, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
  });

  // === Вход в систему ===
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    try {
      const result = await dbQuery(
        'SELECT id, name, email, password_hash, role, is_active, manager_id, credits FROM users WHERE email = $1',
        [email.toLowerCase()],
        'login_get_user'
      );

      if (result.rows.length === 0) {
        logger.warn('Попытка входа с несуществующим email', { email });
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        logger.warn('Попытка входа в деактивированный аккаунт', { userId: user.id, email });
        return res.status(403).json({ error: 'Аккаунт деактивирован' });
      }

      if (!user.password_hash) {
        logger.warn('Попытка входа без установленного пароля', { userId: user.id, email });
        return res.status(401).json({ error: 'Пароль не установлен. Используйте восстановление пароля' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        logger.warn('Неверный пароль при входе', { userId: user.id, email });
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // Обновляем время последнего входа
      await dbQuery(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id],
        'update_last_login'
      );

      // Генерируем JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      logger.info('Успешный вход', { userId: user.id, email: user.email, role: user.role });

      res.json({
        message: 'Вход выполнен успешно',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          manager_id: user.manager_id,
          credits: user.credits
        },
        token
      });

    } catch (err) {
      logger.error('Ошибка входа', { email, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
  });

  // === Запрос на восстановление пароля ===
  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    try {
      const result = await dbQuery(
        'SELECT id, name, email FROM users WHERE email = $1',
        [email.toLowerCase()],
        'forgot_password_get_user'
      );

      // Не раскрываем, существует ли пользователь (безопасность)
      if (result.rows.length === 0) {
        logger.info('Запрос восстановления пароля для несуществующего email', { email });
        return res.json({ message: 'Если email существует, инструкции отправлены' });
      }

      const user = result.rows[0];

      // Генерируем токен сброса пароля
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 час

      await dbQuery(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [resetToken, resetExpires, user.id],
        'set_reset_token'
      );

      // В реальном приложении здесь отправка email
      // Для демонстрации возвращаем токен в ответе (НЕ делайте так в продакшене!)
      logger.info('Токен сброса пароля создан', { userId: user.id, email: user.email });

      res.json({ 
        message: 'Если email существует, инструкции отправлены',
        // ВНИМАНИЕ: В продакшене НЕ возвращайте токен! Отправляйте его по email
        _dev_reset_token: resetToken
      });

    } catch (err) {
      logger.error('Ошибка запроса восстановления пароля', { email, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === Сброс пароля по токену ===
  router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    try {
      const result = await dbQuery(
        `SELECT id, email FROM users 
         WHERE password_reset_token = $1 
         AND password_reset_expires > CURRENT_TIMESTAMP`,
        [token],
        'verify_reset_token'
      );

      if (result.rows.length === 0) {
        logger.warn('Попытка сброса пароля с недействительным токеном');
        return res.status(400).json({ error: 'Недействительный или истёкший токен' });
      }

      const user = result.rows[0];
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      await dbQuery(
        `UPDATE users 
         SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [passwordHash, user.id],
        'reset_password'
      );

      logger.info('Пароль успешно сброшен', { userId: user.id, email: user.email });

      res.json({ message: 'Пароль успешно изменён' });

    } catch (err) {
      logger.error('Ошибка сброса пароля', { error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === Получение текущего пользователя ===
  router.get('/me', authenticateToken, (req, res) => {
    res.json({
      user: req.user
    });
  });

  // === Смена пароля (авторизованный пользователь) ===
  router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
    }

    try {
      const result = await dbQuery(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id],
        'get_current_password'
      );

      const isPasswordValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

      if (!isPasswordValid) {
        logger.warn('Неверный текущий пароль при смене', { userId: req.user.id });
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      await dbQuery(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, req.user.id],
        'change_password'
      );

      logger.info('Пароль успешно изменён', { userId: req.user.id });

      res.json({ message: 'Пароль успешно изменён' });

    } catch (err) {
      logger.error('Ошибка смены пароля', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === ADMIN: Получить всех пользователей с фильтрацией по роли ===
  router.get('/users', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    const { role } = req.query;

    try {
      let query = `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.last_login, u.created_at, 
                   u.manager_id, u.credits, m.name as manager_name 
                   FROM users u 
                   LEFT JOIN users m ON u.manager_id = m.id`;
      let params = [];

      if (role) {
        query += ' WHERE u.role = $1';
        params.push(role);
      }

      query += ' ORDER BY u.created_at DESC';

      const result = await dbQuery(query, params, 'admin_get_users');
      
      logger.info('Список пользователей запрошен', { 
        requestedBy: req.user.id, 
        role: req.user.role,
        filter: role || 'all'
      });

      res.json(result.rows);

    } catch (err) {
      logger.error('Ошибка получения списка пользователей', { error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === ADMIN: Изменить роль пользователя ===
  router.put('/users/:id/role', authenticateToken, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !ROLES.hasOwnProperty(role)) {
      return res.status(400).json({ 
        error: 'Некорректная роль',
        allowedRoles: Object.keys(ROLES)
      });
    }

    // Нельзя изменить свою роль
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя изменить свою собственную роль' });
    }

    try {
      const result = await dbQuery(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, email, role`,
        [role, id],
        'admin_change_role'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      logger.info('Роль пользователя изменена', { 
        adminId: req.user.id,
        targetUserId: id,
        newRole: role
      });

      res.json({
        message: 'Роль успешно изменена',
        user: result.rows[0]
      });

    } catch (err) {
      logger.error('Ошибка изменения роли', { targetUserId: id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === ADMIN: Активировать/деактивировать пользователя ===
  router.put('/users/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active должен быть boolean' });
    }

    // Нельзя деактивировать себя
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя деактивировать свой собственный аккаунт' });
    }

    try {
      const result = await dbQuery(
        `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, email, is_active`,
        [is_active, id],
        'admin_change_status'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      logger.info('Статус пользователя изменён', { 
        adminId: req.user.id,
        targetUserId: id,
        isActive: is_active
      });

      res.json({
        message: is_active ? 'Пользователь активирован' : 'Пользователь деактивирован',
        user: result.rows[0]
      });

    } catch (err) {
      logger.error('Ошибка изменения статуса', { targetUserId: id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === MANAGER/ADMIN: Изменить менеджера клиента ===
  router.put('/users/:id/manager', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    const { id } = req.params;
    const { manager_id } = req.body;

    try {
      // Verify target user exists and is a client
      const targetUser = await dbQuery(
        'SELECT id, role FROM users WHERE id = $1',
        [id],
        'get_target_user_for_manager_change'
      );

      if (targetUser.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (targetUser.rows[0].role !== 'client') {
        return res.status(400).json({ error: 'Можно назначить менеджера только клиенту' });
      }

      // Validate new manager if provided
      if (manager_id !== null && manager_id !== undefined) {
        const managerUser = await dbQuery(
          'SELECT id, role, is_active FROM users WHERE id = $1',
          [manager_id],
          'validate_new_manager'
        );

        if (managerUser.rows.length === 0) {
          return res.status(404).json({ error: 'Менеджер не найден' });
        }

        if (!['manager', 'admin'].includes(managerUser.rows[0].role)) {
          return res.status(400).json({ error: 'Назначить можно только менеджера или админа' });
        }

        if (!managerUser.rows[0].is_active) {
          return res.status(400).json({ error: 'Нельзя назначить деактивированного менеджера' });
        }
      }

      const result = await dbQuery(
        `UPDATE users SET manager_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, email, manager_id`,
        [manager_id || null, id],
        'change_client_manager'
      );

      logger.info('Менеджер клиента изменён', { 
        changedBy: req.user.id,
        clientId: id,
        newManagerId: manager_id
      });

      res.json({
        message: manager_id ? 'Менеджер успешно назначен' : 'Менеджер удалён',
        user: result.rows[0]
      });

    } catch (err) {
      logger.error('Ошибка изменения менеджера', { clientId: id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === MANAGER/ADMIN: Изменить количество кредитов пользователя ===
  router.put('/users/:id/credits', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    const { id } = req.params;
    const { credits } = req.body;

    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ error: 'Кредиты должны быть неотрицательным числом' });
    }

    try {
      const result = await dbQuery(
        `UPDATE users SET credits = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, email, credits`,
        [credits, id],
        'change_user_credits'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      logger.info('Кредиты пользователя изменены', { 
        changedBy: req.user.id,
        targetUserId: id,
        newCredits: credits
      });

      res.json({
        message: 'Кредиты успешно изменены',
        user: result.rows[0]
      });

    } catch (err) {
      logger.error('Ошибка изменения кредитов', { targetUserId: id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === MANAGER: Получить своих клиентов ===
  router.get('/my-clients', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const result = await dbQuery(
        `SELECT id, name, email, phone, role, is_active, credits, last_login, created_at 
         FROM users 
         WHERE manager_id = $1 
         ORDER BY created_at DESC`,
        [req.user.id],
        'get_my_clients'
      );

      logger.info('Список клиентов менеджера запрошен', { 
        managerId: req.user.id,
        clientCount: result.rows.length
      });

      res.json(result.rows);

    } catch (err) {
      logger.error('Ошибка получения списка клиентов', { managerId: req.user.id, error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // === MANAGER: Создать пользователя с определённой ролью ===
  router.post('/users', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    // Manager не может создавать admin или manager
    if (req.user.role === 'manager' && (role === 'admin' || role === 'manager')) {
      return res.status(403).json({ error: 'Недостаточно прав для создания пользователя с такой ролью' });
    }

    const userRole = role || 'client';
    if (!ROLES.hasOwnProperty(userRole)) {
      return res.status(400).json({ 
        error: 'Некорректная роль',
        allowedRoles: Object.keys(ROLES)
      });
    }

    try {
      const existingUser = await dbQuery(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()],
        'check_existing_for_create'
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await dbQuery(
        `INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
         RETURNING id, name, email, role, is_active, created_at`,
        [name, email.toLowerCase(), phone || null, passwordHash, userRole],
        'admin_create_user'
      );

      logger.info('Пользователь создан администратором/менеджером', { 
        createdBy: req.user.id,
        newUserId: result.rows[0].id,
        role: userRole
      });

      res.status(201).json({
        message: 'Пользователь успешно создан',
        user: result.rows[0]
      });

    } catch (err) {
      logger.error('Ошибка создания пользователя', { error: err.message });
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  return { router, authenticateToken, requireRole, ROLES };
}

module.exports = { createAuthRouter, ROLES };

