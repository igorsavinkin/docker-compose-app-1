-- Инициализация базы данных
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем тестовые данные
INSERT INTO users (name, email) VALUES 
    ('Иван Иванов', 'ivan@example.com'),
    ('Мария Петрова', 'maria@example.com'),
    ('Алексей Сидоров', 'alexey@example.com');

