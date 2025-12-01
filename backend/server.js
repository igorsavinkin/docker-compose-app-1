const express = require('express');
const { Pool } = require('pg');
const { runMigrations } = require('./run-migrations');

const app = express();
const port = 3000;

// Конфигурация базы данных
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mydb',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
});

app.use(express.json());

// Инициализация базы данных через миграции
async function initializeDatabase() {
  try {
    // Запускаем миграции
    await runMigrations();
    console.log('Database initialized with migrations');
  } catch (err) {
    console.error('Database initialization error:', err);
    // В production можно выбросить ошибку для остановки приложения
    // throw err;
  }
}

// Маршруты
app.get('/', (req, res) => {
  res.json({ 
    message: 'Добро пожаловать в Docker приложение!',
    timestamp: new Date().toISOString()
  });
});

// Получить всех пользователей
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Добавить пользователя
app.post('/users', async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Обновить пользователя
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *',
      [name, email, phone || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить пользователя
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ message: 'Пользователь удалён', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Инициализация и запуск сервера
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
  });
});

