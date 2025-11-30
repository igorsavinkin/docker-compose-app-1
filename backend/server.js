const express = require('express');
const { Pool } = require('pg');

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

// Создаем таблицу при запуске
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized');
    client.release();
  } catch (err) {
    console.error('Database initialization error:', err);
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
  const { name, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.json(result.rows[0]);
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

