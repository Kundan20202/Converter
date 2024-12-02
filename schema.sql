CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    website TEXT NOT NULL,
    app_type VARCHAR(50) NOT NULL,
    app_link TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
