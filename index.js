const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

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

// Test database connection
pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to the database!');
  }
});

// Routes

// 1. Submit form data
app.post('/submit', async (req, res) => {
  const { app_name, website, app_type } = req.body;

  // Validate input
  if (!app_name || !website || !app_type) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO submissions (app_name, website, app_type) 
       VALUES ($1, $2, $3) RETURNING *`,
      [app_name, website, app_type]
    );
    console.log('Data inserted:', result.rows[0]);
    res.status(201).json({ message: 'Form submitted successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ message: 'Failed to save data' });
  }
});

// 2. Retrieve submissions
app.get('/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

// Root endpoint for testing
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
