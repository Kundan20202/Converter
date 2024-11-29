const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://web_to_app_db_user:qFqUzCUmLZ8KHYZmCdECNnUfjtV82pdP@dpg-ct4buaggph6c73c6fatg-a/web_to_app_db',
  ssl: {
    rejectUnauthorized: false, // Required for Render
  },
});

// Test route
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).send(`Database connection successful: ${result.rows[0].now}`);
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).send('Database connection failed');
  }
});

// Form submission route
app.post('/submit', async (req, res) => {
  try {
    const { app_name, website, app_type } = req.body;

    const query = `
      INSERT INTO submissions (app_name, website, app_type)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [app_name, website, app_type];

    const result = await pool.query(query, values);
    res.status(200).json({ message: 'Form submitted successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ message: 'Error saving data to database' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
