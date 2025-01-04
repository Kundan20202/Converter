DROP TABLE IF EXISTS apps;

CREATE TABLE apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    situation VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_type VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    icon TEXT,
    splash_image TEXT,
    visitors INTEGER,
    features TEXT[],
    app_design VARCHAR(255) NOT NULL,
    customization TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'apps';
