const createTableQuery = `
    CREATE TABLE IF NOT EXISTS apps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        website VARCHAR(255), -- Added website column
        ALTER TABLE apps ADD COLUMN website VARCHAR(255);

        app_name VARCHAR(255) NOT NULL, -- Changed email to app_name as per endpoint
        app_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
`;
