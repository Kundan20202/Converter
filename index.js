const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const winston = require('winston'); // Logging library

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Use this only if your host requires SSL
  },
});
// Creating Table
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    app_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

pool.query(createTableQuery)
  .then(() => console.log("Table 'submissions' is ready"))
  .catch((err) => console.error("Error creating table:", err.stack));


// Test database connection
pool.connect((err) => {
  if (err) {
    logger.error('Database connection error:', err.stack);
  } else {
    logger.info('Connected to the database!');
  }
});

// Routes

// 1. Submit form data
app.post('/submit', async (req, res, next) => {
  const { app_name, website, app_type } = req.body;

  // Validate input
  if (!app_name || !website || !app_type) {
    logger.warn('Validation failed for /submit route');
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO submissions (app_name, website, app_type) 
       VALUES ($1, $2, $3) RETURNING *`,
      [app_name, website, app_type]
    );
    logger.info('Data inserted:', result.rows[0]);
    res.status(201).json({ message: 'Form submitted successfully', data: result.rows[0] });
  } catch (error) {
    logger.error('Error saving data:', error);
    next(error); // Pass error to centralized handler
  }
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).send(`Database connection successful: ${result.rows[0].now}`);
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).send('Database connection failed');
  }
});

// 2. Retrieve submissions
app.get('/submissions', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
    logger.info('Fetched submissions:', result.rows);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    next(error);
  }
});

// Root endpoint for testing
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});
