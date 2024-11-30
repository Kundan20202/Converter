const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Database configuration
const pool = new Pool({
  user: 'web_to_app_db_user',
  host: 'dpg-ct4buaggph6c73c6fatg-a',
  database: 'web_to_app_db',
  password: 'qFqUzCUmLZ8KHYZmCdECNnUfjtV82pdP',
  port: 5432, // Default Postgres port
});

// Middleware
app.use(cors());
app.use(bodyParser.json());


// Fetch all form submissions
app.get('/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY id DESC');
    res.status(200).send(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).send({ error: 'Error fetching submissions.' });
  }
});

// Store form submissions
app.post('/submit', async (req, res) => {
  const { appName, website, appType } = req.body;

  try {
    const query = 'INSERT INTO submissions (app_name, website, app_type) VALUES ($1, $2, $3)';
    await pool.query(query, [appName, website, appType]);
    res.status(200).send({ message: 'Form submitted successfully!' });
  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).send({ error: 'Error saving submission.' });
  }
});

// Provide website URL for Expo app
app.get('/get-website', async (req, res) => {
  try {
    const result = await pool.query('SELECT website FROM submissions ORDER BY id DESC LIMIT 1');
    if (result.rows.length > 0) {
      res.status(200).send({ website: result.rows[0].website });
    } else {
      res.status(404).send({ error: 'No website found.' });
    }
  } catch (error) {
    console.error('Error fetching website:', error);
    res.status(500).send({ error: 'Error fetching website.' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
