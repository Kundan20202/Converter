
CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  app_name VARCHAR(255) NOT NULL,
  website VARCHAR(255) NOT NULL,
  app_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
