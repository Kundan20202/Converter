
DROP TABLE IF EXISTS apps;

CREATE TABLE apps (
    id SERIAL PRIMARY KEY,             
    name VARCHAR(255) NOT NULL,        
    email VARCHAR(255) NOT NULL,       
    website VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,    
    app_url TEXT,                      
    created_at TIMESTAMP DEFAULT NOW() 
);
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'apps';
