const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err) => {
  if (err) {
    logger.error('Database connection error:', err.stack);
  } else {
    logger.info('Connected to the database!');
  }
});

// 1. Submit form data
app.post('/submit', async (req, res) => {
  const { app_name, website, app_type } = req.body;

  if (!app_name || !website || !app_type) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO submissions (app_name, website, app_type) VALUES ($1, $2, $3) RETURNING *`,
      [app_name, website, app_type]
    );
    logger.info('Data inserted:', result.rows[0]);
    res.status(201).json({ message: 'Form submitted successfully', data: result.rows[0] });
  } catch (error) {
    logger.error('Error saving data:', error);
    res.status(500).json({ message: 'Failed to save data' });
  }
});

// 2. Retrieve submissions
app.get('/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

// Root endpoint for testing
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});
