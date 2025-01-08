DROP TABLE IF EXISTS apps;

CREATE TABLE apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    website VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    situation VARCHAR(50) DEFAULT 'Pending',
    app_name VARCHAR(255) DEFAULT 'DefaultAppName',
    app_type VARCHAR(50) DEFAULT NULL,
    visitors TEXT DEFAULT 0,
    country VARCHAR(50) DEFAULT NULL,
    icon TEXT DEFAULT NULL,
    splash_image TEXT DEFAULT NULL,
    customization JSON DEFAULT NULL,
    features TEXT DEFAULT NULL,
    app_design TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON apps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
