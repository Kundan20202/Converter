-- Ensure the table exists
CREATE TABLE IF NOT EXISTS apps (
    id BIGSERIAL PRIMARY KEY,
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
    splash_icon TEXT DEFAULT NULL,
    customization VARCHAR(255) DEFAULT NULL,
    features TEXT DEFAULT NULL,
    app_design TEXT DEFAULT NULL,
    app_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS set_updated_at ON apps;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON apps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
